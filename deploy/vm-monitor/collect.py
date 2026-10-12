#!/usr/bin/env python3
"""VM metrics snapshot for the admin Monitor overlay (VM tab).

Run as root every minute by talentscope-monitor.timer. Writes snapshot.json and history.json
(24 h at 1-minute resolution) into /var/lib/talentscope-monitor, which the app container mounts
read-only. Output must never contain secrets: command lines are reduced to program names and
log lines go through redact().
"""
import json
import os
import re
import socket
import subprocess
import time
import urllib.request
from collections import Counter
from datetime import datetime, timedelta, timezone

OUT_DIR = os.environ.get("MONITOR_DIR", "/var/lib/talentscope-monitor")
APP_CONTAINER = os.environ.get("MONITOR_APP_CONTAINER", "talentscope-api")
DEPLOY_DIR = os.environ.get("MONITOR_DEPLOY_DIR", "/opt/talentscope")
SLOW_TTL_SECONDS = int(os.environ.get("MONITOR_SLOW_TTL", "300"))
HISTORY_POINTS = 1440
NGINX_ACCESS = "/var/log/nginx/access.log"
NGINX_ERROR = "/var/log/nginx/error.log"
SERVICES = os.environ.get("MONITOR_SERVICES", "nginx,docker,ssh,qwen,facenet,cron").split(",")
AI_ENDPOINTS = {
    "Qwen LLM": os.environ.get("MONITOR_QWEN_URL", "http://172.17.0.1:8080/health"),
    "FaceNet": os.environ.get("MONITOR_FACENET_URL", "http://172.17.0.1:10000/health"),
}

SECRET_RE = re.compile(
    r"(?i)(password|passwd|pwd|secret|token|api[_-]?key|authorization|bearer)([\"']?\s*[:=]\s*[\"']?|\s+)[^\s,;\"'&]+"
)
UUID_RE = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", re.I)


def redact(text):
    return SECRET_RE.sub(lambda m: f"{m.group(1)}{m.group(2)}<redacted>", text or "")


def run(cmd, timeout=20):
    try:
        return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout).stdout
    except Exception:
        return ""


def run_all(cmd, timeout=20):
    """stdout + stderr (docker logs writes app output to both)."""
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return (r.stdout or "") + (r.stderr or "")
    except Exception:
        return ""


def slow_cached(name, fn):
    path = os.path.join(OUT_DIR, f".cache-{name}.json")
    try:
        if time.time() - os.path.getmtime(path) < SLOW_TTL_SECONDS:
            return json.loads(read(path, "null"))
    except OSError:
        pass
    value = fn()
    write_json(path, value)
    return value


def safe(fn, *args):
    try:
        return fn(*args)
    except Exception as exc:  # one broken section must not hide the rest
        return {"error": f"{type(exc).__name__}: {exc}"}


def read(path, default=""):
    try:
        with open(path, encoding="utf-8", errors="replace") as fh:
            return fh.read()
    except Exception:
        return default


def tail_lines(path, max_bytes=6_000_000):
    try:
        with open(path, "rb") as fh:
            fh.seek(0, os.SEEK_END)
            size = fh.tell()
            fh.seek(max(0, size - max_bytes))
            data = fh.read().decode("utf-8", errors="replace")
        lines = data.splitlines()
        return lines[1:] if size > max_bytes else lines
    except Exception:
        return []


def systemd_show(unit, props):
    out = run(["systemctl", "show", unit, "-p", ",".join(props)])
    res = {}
    for line in out.splitlines():
        if "=" in line:
            k, v = line.split("=", 1)
            res[k] = v
    return res


def ts_or_none(value):
    return value if value and value not in ("n/a", "0") else None


# ---------------------------------------------------------------- system

def cpu_times():
    parts = read("/proc/stat").splitlines()[0].split()[1:]
    vals = [int(x) for x in parts]
    names = ["user", "nice", "system", "idle", "iowait", "irq", "softirq", "steal"]
    return dict(zip(names, vals + [0] * (len(names) - len(vals))))


def cpu_usage(sample_seconds=1.0):
    a = cpu_times()
    time.sleep(sample_seconds)
    b = cpu_times()
    delta = {k: b[k] - a[k] for k in a}
    total = sum(delta.values()) or 1
    pct = lambda k: round(100.0 * delta[k] / total, 1)
    return {
        "percent": round(100.0 * (total - delta["idle"] - delta["iowait"]) / total, 1),
        "user": pct("user"), "system": pct("system"), "iowait": pct("iowait"), "steal": pct("steal"),
    }


def meminfo():
    info = {}
    for line in read("/proc/meminfo").splitlines():
        k, _, rest = line.partition(":")
        info[k] = int(rest.strip().split()[0]) * 1024
    total, avail = info.get("MemTotal", 0), info.get("MemAvailable", 0)
    swap_total, swap_free = info.get("SwapTotal", 0), info.get("SwapFree", 0)
    return {
        "total": total, "available": avail, "used": total - avail,
        "percent": round(100.0 * (total - avail) / total, 1) if total else 0,
        "buffers": info.get("Buffers", 0), "cached": info.get("Cached", 0),
        "swapTotal": swap_total, "swapUsed": swap_total - swap_free,
        "swapPercent": round(100.0 * (swap_total - swap_free) / swap_total, 1) if swap_total else 0,
    }


def disks():
    out = run(["df", "-B1", "-T", "-x", "tmpfs", "-x", "devtmpfs", "-x", "squashfs", "-x", "overlay", "-x", "efivarfs"])
    inodes = {}
    for line in run(["df", "-i", "-x", "tmpfs", "-x", "devtmpfs", "-x", "squashfs", "-x", "overlay", "-x", "efivarfs"]).splitlines()[1:]:
        p = line.split()
        if len(p) >= 6:
            inodes[p[5]] = p[4]
    res = []
    for line in out.splitlines()[1:]:
        p = line.split()
        if len(p) < 7:
            continue
        total, used, avail = int(p[2]), int(p[3]), int(p[4])
        res.append({
            "device": p[0], "fs": p[1], "mount": p[6], "total": total, "used": used, "available": avail,
            "percent": round(100.0 * used / total, 1) if total else 0, "inodesPercent": inodes.get(p[6]),
        })
    return res


def net_counters():
    res = {}
    for line in read("/proc/net/dev").splitlines()[2:]:
        name, _, rest = line.partition(":")
        name = name.strip()
        if name == "lo" or name.startswith("veth"):
            continue
        f = rest.split()
        res[name] = {"rx": int(f[0]), "tx": int(f[8]), "rxErrors": int(f[2]), "txErrors": int(f[10]), "rxDrop": int(f[3]), "txDrop": int(f[11])}
    return res


def ip_addresses():
    res = []
    for line in run(["ip", "-4", "-o", "addr", "show"]).splitlines():
        p = line.split()
        if len(p) >= 4 and p[1] != "lo":
            res.append({"iface": p[1], "address": p[3]})
    return res


def top_processes(sort_key):
    out = run(["ps", "-eo", "pid,user:16,pcpu,pmem,rss,etimes,comm", f"--sort=-{sort_key}"])
    res = []
    for line in out.splitlines()[1:11]:
        p = line.split(None, 6)
        if len(p) == 7:
            res.append({"pid": int(p[0]), "user": p[1], "cpu": float(p[2]), "mem": float(p[3]),
                        "rssBytes": int(p[4]) * 1024, "uptimeSeconds": int(p[5]), "command": p[6]})
    return res


def system_info():
    os_release = dict(
        line.split("=", 1) for line in read("/etc/os-release").splitlines() if "=" in line
    )
    cpu_model = next((l.split(":", 1)[1].strip() for l in read("/proc/cpuinfo").splitlines() if l.startswith("model name")), "")
    uptime = float(read("/proc/uptime", "0").split()[0])
    updates_text = " ".join(read("/var/lib/update-notifier/updates-available").split())
    count = lambda pattern: int(m.group(1)) if (m := re.search(pattern, updates_text)) else 0
    return {
        "hostname": socket.gethostname(),
        "os": os_release.get("PRETTY_NAME", "").strip('"'),
        "kernel": os.uname().release,
        "cpuModel": cpu_model,
        "cores": os.cpu_count(),
        "uptimeSeconds": int(uptime),
        "bootTime": datetime.fromtimestamp(time.time() - uptime, timezone.utc).isoformat(),
        "load": list(os.getloadavg()),
        "ntpSynchronized": run(["timedatectl", "show", "-p", "NTPSynchronized", "--value"]).strip() == "yes",
        "timezone": run(["timedatectl", "show", "-p", "Timezone", "--value"]).strip(),
        "rebootRequired": os.path.exists("/var/run/reboot-required"),
        "pendingUpdates": count(r"(\d+) updates? can be applied"),
        "pendingSecurityUpdates": count(r"(\d+) (?:of these updates? (?:is|are) (?:a )?(?:standard )?security|additional security) updates?"),
        "loggedInUsers": len([l for l in run(["who"]).splitlines() if l.strip()]),
        "ipAddresses": ip_addresses(),
        "processCount": sum(1 for d in os.listdir("/proc") if d.isdigit()),
    }


# ---------------------------------------------------------------- services and timers

def services():
    units = list(SERVICES)
    units += [l.split()[0] for l in run(["systemctl", "list-units", "--all", "--plain", "--no-legend", "actions.runner.*"]).splitlines() if l.strip()]
    props = ["Id", "Description", "LoadState", "ActiveState", "SubState", "UnitFileState", "ActiveEnterTimestamp", "MemoryCurrent", "NRestarts"]
    res = []
    for unit in units:
        s = systemd_show(unit if "." in unit else f"{unit}.service", props)
        if s.get("LoadState") != "loaded":
            continue
        mem = s.get("MemoryCurrent", "")
        res.append({
            "unit": s.get("Id"), "description": s.get("Description"), "active": s.get("ActiveState"), "sub": s.get("SubState"),
            "enabled": s.get("UnitFileState"), "since": ts_or_none(s.get("ActiveEnterTimestamp")),
            "memoryBytes": int(mem) if mem.isdigit() else None, "restarts": int(s.get("NRestarts") or 0),
        })
    failed = [l.split()[0] for l in run(["systemctl", "--failed", "--plain", "--no-legend"]).splitlines() if l.strip()]
    return {"units": res, "failed": failed}


def timers():
    names = [l.split()[0] for l in run(["systemctl", "list-units", "--all", "--type=timer", "--plain", "--no-legend", "talentscope-*"]).splitlines() if l.strip()]
    res = []
    for name in sorted(names):
        t = systemd_show(name, ["Id", "ActiveState", "UnitFileState", "LastTriggerUSec", "NextElapseUSecRealtime", "Unit"])
        svc = t.get("Unit", "")
        s = systemd_show(svc, ["Result", "ExecMainStatus", "ExecMainStartTimestamp", "ExecMainExitTimestamp", "ActiveState"])
        log = run(["journalctl", "-u", svc, "--since", "-24h", "-o", "short-iso", "--no-pager", "-q"], timeout=30).splitlines()
        runs = sum(1 for l in log if " Finished " in l)
        fails = sum(1 for l in log if "Failed with result" in l or "failed with result" in l or "Failed to start" in l)
        summary = next((l for l in reversed(log) if "[sync] done" in l or "[storage] done" in l), None)
        errors = [redact(l)[:300] for l in log if re.search(r"(?i)\b(error|exception|failed)\b", l) and "Failed with result" not in l][-5:]
        start, end = ts_or_none(s.get("ExecMainStartTimestamp")), ts_or_none(s.get("ExecMainExitTimestamp"))
        res.append({
            "timer": name, "service": svc, "active": t.get("ActiveState"), "enabled": t.get("UnitFileState"),
            "lastTrigger": ts_or_none(t.get("LastTriggerUSec")), "next": ts_or_none(t.get("NextElapseUSecRealtime")),
            "lastResult": s.get("Result"), "lastExitStatus": s.get("ExecMainStatus"), "lastStart": start, "lastEnd": end,
            "running": s.get("ActiveState") == "activating",
            "runs24h": runs, "failures24h": fails,
            "lastSummary": redact(summary.split(": ", 1)[-1])[:300] if summary else None,
            "recentErrors": errors,
        })
    return res


# ---------------------------------------------------------------- docker

def docker_info():
    containers = [json.loads(l) for l in run(["docker", "ps", "-a", "--format", "{{json .}}"]).splitlines() if l.strip()]
    stats = {}
    for l in run(["docker", "stats", "--no-stream", "--format", "{{json .}}"], timeout=30).splitlines():
        if l.strip():
            s = json.loads(l)
            stats[s.get("Name")] = s
    res = []
    for c in containers:
        s = stats.get(c.get("Names"), {})
        res.append({
            "name": c.get("Names"), "image": c.get("Image"), "state": c.get("State"), "status": c.get("Status"),
            "ports": c.get("Ports"), "created": c.get("CreatedAt"),
            "cpu": s.get("CPUPerc"), "mem": s.get("MemUsage"), "memPercent": s.get("MemPerc"),
            "netIO": s.get("NetIO"), "blockIO": s.get("BlockIO"), "pids": s.get("PIDs"),
        })
    df = [json.loads(l) for l in run(["docker", "system", "df", "--format", "{{json .}}"]).splitlines() if l.strip()]
    images = [json.loads(l) for l in run(["docker", "images", "--format", "{{json .}}"]).splitlines() if l.strip()]
    return {
        "containers": res,
        "diskUsage": [{"type": d.get("Type"), "count": d.get("TotalCount"), "active": d.get("Active"), "size": d.get("Size"), "reclaimable": d.get("Reclaimable")} for d in df],
        "images": [{"repo": f"{i.get('Repository')}:{i.get('Tag')}", "id": i.get("ID"), "size": i.get("Size"), "created": i.get("CreatedSince")} for i in images[:25]],
    }


def app_container():
    raw = run(["docker", "inspect", APP_CONTAINER, "--format", "{{json .State}}|{{.RestartCount}}|{{.Image}}|{{.Created}}"])
    if not raw.strip():
        return {"error": f"container {APP_CONTAINER} not found"}
    state_json, restarts, image, created = raw.strip().split("|", 3)
    state = json.loads(state_json)
    logs_60 = run_all(["docker", "logs", "--since", "60m", APP_CONTAINER], timeout=30).splitlines()
    is_err = lambda l: re.search(r"(?i)\b(error|unhandled|exception|ECONNREFUSED|ETIMEDOUT|ECONNRESET)\b", l)
    is_warn = lambda l: re.search(r"(?i)\b(warn|warning|fallback|falling back|timed out)\b", l)
    interesting = [redact(l)[:400] for l in logs_60 if is_err(l) or is_warn(l)]

    def day_counts():
        logs_24 = run_all(["docker", "logs", "--since", "24h", APP_CONTAINER], timeout=60).splitlines()
        return {"errors": sum(1 for l in logs_24 if is_err(l)), "warnings": sum(1 for l in logs_24 if is_warn(l) and not is_err(l))}

    day = slow_cached("app-24h", day_counts) or {"errors": 0, "warnings": 0}
    return {
        "name": APP_CONTAINER, "status": state.get("Status"), "health": (state.get("Health") or {}).get("Status"),
        "startedAt": state.get("StartedAt"), "restarts": int(restarts or 0), "oomKilled": state.get("OOMKilled"),
        "image": image[:19], "created": created,
        "errors60m": sum(1 for l in logs_60 if is_err(l)), "warnings60m": sum(1 for l in logs_60 if is_warn(l) and not is_err(l)),
        "errors24h": day["errors"], "warnings24h": day["warnings"],
        "logLines60m": len(logs_60),
        "recentLog": interesting[-60:],
    }


# ---------------------------------------------------------------- nginx

NGINX_RE = re.compile(r'^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) (\S+)[^"]*" (\d{3}) (\d+|-)')


def normalise_path(path):
    path = path.split("?", 1)[0]
    path = UUID_RE.sub(":id", path)
    return re.sub(r"/\d{3,}(?=/|$)", "/:n", path)


def nginx_stats():
    now = datetime.now(timezone.utc)
    hour_ago, day_ago = now - timedelta(minutes=60), now - timedelta(hours=24)
    per_min = {}
    status60, status24 = Counter(), Counter()
    paths, ips = Counter(), Counter()
    errors_5xx, bytes60, total24 = [], 0, 0
    for path_file in (NGINX_ACCESS + ".1", NGINX_ACCESS):
        for line in tail_lines(path_file):
            m = NGINX_RE.match(line)
            if not m:
                continue
            try:
                t = datetime.strptime(m.group(2), "%d/%b/%Y:%H:%M:%S %z")
            except ValueError:
                continue
            if t < day_ago:
                continue
            code = int(m.group(5))
            klass = f"{code // 100}xx"
            status24[klass] += 1
            total24 += 1
            if t >= hour_ago:
                status60[str(code)] += 1
                key = t.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M")
                bucket = per_min.setdefault(key, {"t": key, "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0})
                if klass in bucket:
                    bucket[klass] += 1
                paths[f"{m.group(3)} {normalise_path(m.group(4))}"] += 1
                ips[m.group(1)] += 1
                bytes60 += int(m.group(6)) if m.group(6).isdigit() else 0
            if code >= 500:
                errors_5xx.append({"time": t.isoformat(), "ip": m.group(1), "method": m.group(3), "path": normalise_path(m.group(4)), "status": code})
    minutes = []
    for i in range(60, -1, -1):
        key = (now - timedelta(minutes=i)).strftime("%Y-%m-%dT%H:%M")
        minutes.append(per_min.get(key, {"t": key, "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0}))
    err_lines = [l for l in tail_lines(NGINX_ERROR, 2_000_000) if l[:4].isdigit()]
    day_prefix = day_ago.strftime("%Y/%m/%d %H:%M:%S")
    https_conns = len([l for l in run(["ss", "-Htn", "state", "established", "( sport = :443 )"]).splitlines() if l.strip()])
    return {
        "requests60m": sum(status60.values()), "requests24h": total24, "bytes60m": bytes60,
        "status60m": dict(status60.most_common()), "status24h": dict(status24),
        "perMinute": minutes,
        "topPaths": [{"path": p, "count": c} for p, c in paths.most_common(15)],
        "topClients": [{"ip": ip, "count": c, "note": "Azure health probe" if ip == "168.63.129.16" else None} for ip, c in ips.most_common(10)],
        "recent5xx": errors_5xx[-25:],
        "errorLog24h": sum(1 for l in err_lines if l[:19] >= day_prefix),
        "errorLogTail": [redact(l)[:300] for l in err_lines[-20:]],
        "httpsConnections": https_conns,
    }


def tls_cert():
    conf = run(["nginx", "-T"], timeout=15)
    paths = re.findall(r"^\s*ssl_certificate\s+([^;]+);", conf, re.M)
    if not paths:
        return {"error": "no ssl_certificate in nginx config"}
    path = paths[0].strip()
    out = run(["openssl", "x509", "-in", path, "-noout", "-subject", "-issuer", "-startdate", "-enddate", "-ext", "subjectAltName"])
    info = {"path": path}
    for line in out.splitlines():
        if line.startswith("subject="):
            info["subject"] = line[8:].strip()
        elif line.startswith("issuer="):
            info["issuer"] = line[7:].strip()
        elif line.startswith("notBefore="):
            info["validFrom"] = datetime.strptime(line[10:].strip(), "%b %d %H:%M:%S %Y %Z").replace(tzinfo=timezone.utc).isoformat()
        elif line.startswith("notAfter="):
            end = datetime.strptime(line[9:].strip(), "%b %d %H:%M:%S %Y %Z").replace(tzinfo=timezone.utc)
            info["validTo"] = end.isoformat()
            info["daysLeft"] = (end - datetime.now(timezone.utc)).days
        elif "DNS:" in line:
            info["names"] = [n.strip()[4:] for n in line.split(",") if n.strip().startswith("DNS:")]
    return info


# ---------------------------------------------------------------- AI services

def ai_services():
    res = []
    for name, url in AI_ENDPOINTS.items():
        t0 = time.time()
        try:
            with urllib.request.urlopen(url, timeout=4) as r:
                code = r.status
        except urllib.error.HTTPError as e:
            code = e.code
        except Exception as e:
            code = None
            err = type(e).__name__
        else:
            err = None
        res.append({"name": name, "url": url, "status": code,
                    "latencyMs": round((time.time() - t0) * 1000), "ok": code is not None and code < 500, "error": err if code is None else None})
    def qwen_stats():
        qlog = run(["journalctl", "-u", "qwen", "--since", "-24h", "-o", "cat", "--no-pager", "-q"], timeout=30).splitlines()
        speeds = [float(m.group(1)) for l in qlog for m in [re.search(r"prompt processing.*?/\s*([\d.]+) tokens per second", l)] if m and "progress = 1.00" in l]
        gen = [float(m.group(1)) for l in qlog for m in [re.search(r"eval time.*?([\d.]+) tokens per second", l)] if m]
        return {
            "requests24h": sum(1 for l in qlog if "launch_slot_" in l),
            "contextOverflow24h": sum(1 for l in qlog if "exceeds the available context size" in l),
            "cancelled24h": sum(1 for l in qlog if "cancel task" in l),
            "promptTokensPerSecond": speeds[-10:],
            "generationTokensPerSecond": gen[-10:],
        }

    stats = slow_cached("qwen-24h", qwen_stats) or {}
    ctx = None
    for l in run(["ps", "-eo", "args"]).splitlines():
        m = re.search(r"--ctx-size\s+(\d+)", l)
        if m:
            ctx = int(m.group(1))
    return {
        "endpoints": res,
        "qwen": {"contextSize": ctx, **stats},
    }


# ---------------------------------------------------------------- security, journal, deploy

def security():
    logins, reboots = [], []
    for line in run(["last", "-n", "25", "-F", "-i", "-w"]).splitlines():
        if not line.strip() or line.startswith("wtmp"):
            continue
        p = line.split()
        if p[0] == "reboot":
            reboots.append(" ".join(p[4:9]))
            continue
        if len(p) >= 9:
            logins.append({"user": p[0], "tty": p[1], "from": p[2], "login": " ".join(p[3:8]), "until": " ".join(p[9:]) or None})
    ssh_log = run(["journalctl", "-u", "ssh", "-u", "sshd", "--since", "-24h", "-o", "cat", "--no-pager", "-q"], timeout=30).splitlines()
    failed = [l for l in ssh_log if re.search(r"Failed password|Invalid user|authentication failure|Connection closed by invalid", l)]
    fail_ips = Counter(m.group(1) for l in failed for m in [re.search(r"from (\d+\.\d+\.\d+\.\d+)", l)] if m)
    accepted = [l for l in ssh_log if "Accepted " in l]
    listening = []
    for line in run(["ss", "-Hltnp"]).splitlines():
        p = line.split()
        if len(p) >= 4:
            proc = re.search(r'users:\(\("([^"]+)"', line)
            listening.append({"address": p[3], "process": proc.group(1) if proc else None})
    kernel = run(["journalctl", "-k", "--since", "-7d", "-o", "cat", "--no-pager", "-q"], timeout=30)
    return {
        "recentLogins": logins[:20],
        "recentReboots": reboots[:5],
        "sshAccepted24h": len(accepted),
        "sshFailed24h": len(failed),
        "sshFailedTopIps": [{"ip": ip, "count": c} for ip, c in fail_ips.most_common(10)],
        "sudoCommands24h": run(["journalctl", "_COMM=sudo", "--since", "-24h", "-o", "cat", "--no-pager", "-q"], timeout=30).count("COMMAND="),
        "oomKills7d": len(re.findall(r"(?i)out of memory: killed", kernel)),
        "listeningPorts": sorted({(l["address"], l["process"]) for l in listening}),
    }


JOURNAL_NOISE = re.compile(r'networkctl\[\d+\]: Interface "veth\w+" not found')


def journal_errors():
    out = run(["journalctl", "-p", "err", "--since", "-24h", "-o", "short-iso", "--no-pager", "-q"], timeout=30).splitlines()
    real = [l for l in out if not JOURNAL_NOISE.search(l)]
    return {"count24h": len(real), "ignoredNoise24h": len(out) - len(real), "recent": [redact(l)[:300] for l in real[-30:]]}


def deployment():
    commit_file = os.path.join(DEPLOY_DIR, "DEPLOYED_COMMIT")
    res = {"commit": read(commit_file).strip() or None}
    if os.path.exists(commit_file):
        res["deployedAt"] = datetime.fromtimestamp(os.path.getmtime(commit_file), timezone.utc).isoformat()
    diag = "/home/azureuser/actions-runner/_diag"
    try:
        workers = sorted((f for f in os.listdir(diag) if f.startswith("Worker_")), key=lambda f: os.path.getmtime(os.path.join(diag, f)))
        if workers:
            res["lastRunnerJob"] = datetime.fromtimestamp(os.path.getmtime(os.path.join(diag, workers[-1])), timezone.utc).isoformat()
            res["runnerJobs"] = len(workers)
    except Exception:
        pass
    return res


# ---------------------------------------------------------------- history

def update_history(snapshot):
    path = os.path.join(OUT_DIR, "history.json")
    try:
        history = json.loads(read(path, "[]"))
    except Exception:
        history = []
    net = snapshot["network"] if isinstance(snapshot.get("network"), dict) else {}
    rx = sum(v["rx"] for v in net.values())
    tx = sum(v["tx"] for v in net.values())
    now = time.time()
    rx_rate = tx_rate = None
    if history:
        prev = history[-1]
        dt = now - prev.get("ts", now)
        if 0 < dt < 600 and prev.get("rx") is not None and rx >= prev["rx"]:
            rx_rate, tx_rate = round((rx - prev["rx"]) / dt), round((tx - prev["tx"]) / dt)
    app = next((c for c in snapshot.get("docker", {}).get("containers", []) if c.get("name") == APP_CONTAINER), {}) if isinstance(snapshot.get("docker"), dict) else {}
    root = next((d for d in snapshot.get("disks", []) if d.get("mount") == "/"), {}) if isinstance(snapshot.get("disks"), list) else {}
    minutes = snapshot.get("nginx", {}).get("perMinute", []) if isinstance(snapshot.get("nginx"), dict) else []
    last_full = minutes[-2] if len(minutes) >= 2 else {}
    point = {
        "ts": now, "t": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "cpu": snapshot.get("cpu", {}).get("percent"), "iowait": snapshot.get("cpu", {}).get("iowait"),
        "mem": snapshot.get("memory", {}).get("percent"), "swap": snapshot.get("memory", {}).get("swapPercent"),
        "load1": snapshot.get("system", {}).get("load", [None])[0], "disk": root.get("percent"),
        "rx": rx, "tx": tx, "rxRate": rx_rate, "txRate": tx_rate,
        "appCpu": float(str(app.get("cpu", "")).rstrip("%") or 0) if app.get("cpu") else None,
        "appMemPercent": float(str(app.get("memPercent", "")).rstrip("%") or 0) if app.get("memPercent") else None,
        "requests": sum(last_full.get(k, 0) for k in ("2xx", "3xx", "4xx", "5xx")) if last_full else None,
        "errors5xx": last_full.get("5xx") if last_full else None,
    }
    history.append(point)
    history = history[-HISTORY_POINTS:]
    write_json(path, history)


def write_json(path, data):
    tmp = f"{path}.tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(data, fh, separators=(",", ":"), default=str)
    os.chmod(tmp, 0o644)
    os.replace(tmp, path)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    started = time.time()
    snapshot = {
        "collectedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "cpu": safe(cpu_usage),
        "memory": safe(meminfo),
        "system": safe(system_info),
        "disks": safe(disks),
        "network": safe(net_counters),
        "topCpu": safe(top_processes, "pcpu"),
        "topMemory": safe(top_processes, "rss"),
        "services": safe(services),
        "timers": safe(timers),
        "docker": safe(docker_info),
        "app": safe(app_container),
        "nginx": safe(nginx_stats),
        "tls": safe(tls_cert),
        "ai": safe(ai_services),
        "security": safe(security),
        "journal": safe(journal_errors),
        "deployment": safe(deployment),
    }
    snapshot["collectSeconds"] = round(time.time() - started, 1)
    write_json(os.path.join(OUT_DIR, "snapshot.json"), snapshot)
    update_history(snapshot)


if __name__ == "__main__":
    main()
