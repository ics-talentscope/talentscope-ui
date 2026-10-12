"use client";

import React, { useMemo } from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  Box,
  Clock,
  Cpu,
  GitCommit,
  Globe,
  HardDrive,
  KeyRound,
  ListChecks,
  MemoryStick,
  Network,
  ScrollText,
  Server,
  ShieldCheck,
  Timer,
} from "lucide-react";
import {
  Bars,
  COLORS,
  DataTable,
  KV,
  LogList,
  Meter,
  Panel,
  Pill,
  StatCard,
  StatusDot,
  TimeArea,
  ageSeconds,
  fmtAgo,
  fmtBytes,
  fmtDate,
  fmtDuration,
  fmtNum,
  fmtPct,
  timeLabel,
  toneFor,
  type Tone,
} from "./ui";

const hasError = (v: any) => v && typeof v === "object" && !Array.isArray(v) && "error" in v && Object.keys(v).length === 1;

function SectionError({ value }: { value: any }) {
  return hasError(value) ? <p className="text-xs text-rose-500 break-words">Collector error: {value.error}</p> : null;
}

const shortUnit = (u: string) => String(u).replace(/\.service$/, "").replace(/^actions\.runner\..*/, "github-runner");

export default function VmPanel({ data, liveHistory }: { data: any; liveHistory: Array<{ t: string; cpu: number; mem: number }> }) {
  const s = data?.snapshot ?? {};
  const live = data?.live && !data.live.error ? data.live : null;
  const collector = data?.collector ?? {};
  const history: any[] = data?.history ?? [];
  const runtime = data?.runtime ?? null;

  const sys = hasError(s.system) ? {} : s.system ?? {};
  const mem = hasError(s.memory) ? {} : s.memory ?? {};
  const disks: any[] = Array.isArray(s.disks) ? s.disks : [];
  const root = disks.find((d) => d.mount === "/");
  const services: any[] = s.services?.units ?? [];
  const failedUnits: string[] = s.services?.failed ?? [];
  const timers: any[] = Array.isArray(s.timers) ? s.timers : [];
  const containers: any[] = s.docker?.containers ?? [];
  const app = hasError(s.app) ? null : s.app;
  const nginx = hasError(s.nginx) ? null : s.nginx;
  const tls = hasError(s.tls) ? null : s.tls;
  const ai = hasError(s.ai) ? null : s.ai;
  const sec = hasError(s.security) ? null : s.security;
  const journal = hasError(s.journal) ? null : s.journal;
  const deploy = hasError(s.deployment) ? null : s.deployment;

  const cpuNow = live?.cpuPercent ?? s.cpu?.percent;
  const memNow = live?.memPercent ?? mem.percent;
  const load = live?.load ?? sys.load ?? [];
  const cores = Number(sys.cores) || 2;
  const downServices = services.filter((u) => u.active !== "active");
  const failedTimers = timers.filter((t) => t.lastResult && t.lastResult !== "success");
  const err5xx60 = nginx ? Object.entries(nginx.status60m ?? {}).filter(([k]) => k.startsWith("5")).reduce((a, [, v]) => a + Number(v), 0) : 0;

  const historyChart = useMemo(
    () =>
      history.map((p) => ({
        t: p.t,
        cpu: p.cpu,
        mem: p.mem,
        swap: p.swap,
        load1: p.load1,
        iowait: p.iowait,
        rx: p.rxRate !== null && p.rxRate !== undefined ? Math.round(p.rxRate / 1024) : null,
        tx: p.txRate !== null && p.txRate !== undefined ? Math.round(p.txRate / 1024) : null,
        appCpu: p.appCpu,
        appMem: p.appMemPercent,
        requests: p.requests,
        errors5xx: p.errors5xx,
        disk: p.disk,
      })),
    [history],
  );

  if (!data) return null;

  const servicesTone: Tone = downServices.length || failedUnits.length ? "bad" : "ok";
  const certTone = toneFor(tls?.daysLeft, 30, 14, false);

  return (
    <div className="space-y-5">
      {(!collector.available || collector.stale) && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4" />
            {collector.available ? `VM details are ${fmtDuration(collector.ageSeconds)} old` : "VM details are not available"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Live CPU, memory and load below still work. Services, Docker, nginx, logs and history come from the collector
            (<code>talentscope-monitor.timer</code>), which writes to <code>{collector.dir}</code> every minute. It is installed by the deploy
            script; to check it on the VM run <code>systemctl status talentscope-monitor.timer</code>.
            {collector.error ? ` (${collector.error})` : ""}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        <StatCard label="CPU" value={fmtPct(cpuNow)} sub={`${cores} vCPU · iowait ${fmtPct(s.cpu?.iowait)}`} tone={toneFor(cpuNow, 70, 90)} icon={Cpu} />
        <StatCard
          label="Memory"
          value={fmtPct(memNow)}
          sub={`${fmtBytes(live?.memUsed ?? mem.used)} of ${fmtBytes(live?.memTotal ?? mem.total)} · swap ${fmtBytes(live?.swapUsed ?? mem.swapUsed)}`}
          tone={toneFor(memNow, 80, 92)}
          icon={MemoryStick}
        />
        <StatCard
          label="Load average"
          value={load.length ? Number(load[0]).toFixed(2) : "—"}
          sub={load.length ? `5 min ${Number(load[1]).toFixed(2)} · 15 min ${Number(load[2]).toFixed(2)} (${cores} cores)` : "—"}
          tone={toneFor(load[0], cores * 0.8, cores * 1.5)}
          icon={Activity}
        />
        <StatCard label="Disk /" value={root ? fmtPct(root.percent) : "—"} sub={root ? `${fmtBytes(root.available)} free of ${fmtBytes(root.total)}` : "—"} tone={toneFor(root?.percent, 80, 90)} icon={HardDrive} />
        <StatCard label="Uptime" value={fmtDuration(live?.uptimeSeconds ?? sys.uptimeSeconds)} sub={sys.bootTime ? `booted ${fmtDate(sys.bootTime)}` : undefined} icon={Clock} />
        <StatCard
          label="App container"
          value={app ? (app.health ?? app.status) : "—"}
          sub={app ? `${app.restarts} restarts · up ${fmtAgo(app.startedAt).replace(" ago", "")}` : "—"}
          tone={app ? (app.health === "healthy" || (!app.health && app.status === "running") ? "ok" : "bad") : "muted"}
          icon={Box}
        />
        <StatCard
          label="Requests (60 min)"
          value={nginx ? fmtNum(nginx.requests60m) : "—"}
          sub={nginx ? `${err5xx60} server errors · ${fmtNum(nginx.requests24h)} in 24 h` : "—"}
          tone={err5xx60 > 0 ? "warn" : "ok"}
          icon={Globe}
        />
        <StatCard
          label="Services"
          value={services.length ? `${services.length - downServices.length}/${services.length} up` : "—"}
          sub={failedUnits.length ? `failed: ${failedUnits.join(", ")}` : failedTimers.length ? `${failedTimers.length} job(s) failed last run` : "no failed units"}
          tone={failedTimers.length && servicesTone === "ok" ? "warn" : servicesTone}
          icon={ListChecks}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Panel title="CPU & memory (24 h)" icon={Cpu} subtitle="One point per minute from the collector">
          <TimeArea
            data={historyChart}
            series={[
              { key: "cpu", label: "CPU %", color: COLORS.indigo },
              { key: "mem", label: "Memory %", color: COLORS.emerald },
              { key: "swap", label: "Swap %", color: COLORS.amber },
            ]}
            unit="%"
            yMax={100}
            height={210}
          />
        </Panel>
        <Panel title="Live (this window)" icon={Activity} subtitle="Sampled on every refresh while the monitor is open">
          <TimeArea
            data={liveHistory}
            series={[
              { key: "cpu", label: "CPU %", color: COLORS.indigo },
              { key: "mem", label: "Memory %", color: COLORS.emerald },
            ]}
            unit="%"
            yMax={100}
            height={210}
          />
        </Panel>
        <Panel title="Load & I/O wait (24 h)" icon={Activity}>
          <TimeArea
            data={historyChart}
            series={[
              { key: "load1", label: "Load (1 min)", color: COLORS.violet },
              { key: "iowait", label: "I/O wait %", color: COLORS.rose },
            ]}
            height={190}
          />
        </Panel>
        <Panel title="Network throughput (24 h)" icon={Network} subtitle="All interfaces except loopback, KB/s">
          <TimeArea
            data={historyChart}
            series={[
              { key: "rx", label: "In KB/s", color: COLORS.sky },
              { key: "tx", label: "Out KB/s", color: COLORS.amber },
            ]}
            height={190}
          />
        </Panel>

        <Panel title="Web traffic (nginx)" icon={Globe} className="xl:col-span-2" subtitle="HTTPS requests per minute, last 60 minutes">
          <SectionError value={s.nginx} />
          {nginx && (
            <>
              <Bars
                data={nginx.perMinute}
                series={[
                  { key: "2xx", label: "2xx", color: COLORS.emerald },
                  { key: "3xx", label: "3xx", color: COLORS.sky },
                  { key: "4xx", label: "4xx", color: COLORS.amber },
                  { key: "5xx", label: "5xx", color: COLORS.rose },
                ]}
                xKey="t"
                stacked
                height={190}
                xFormatter={(v) => timeLabel(`${v}:00Z`)}
              />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
                <div>
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">Status codes</p>
                  <KV
                    items={[
                      ...Object.entries(nginx.status60m ?? {}).map(([code, n]) => [`${code} (60 min)`, fmtNum(n), code.startsWith("5") ? "bad" : code.startsWith("4") ? "warn" : undefined] as [string, React.ReactNode, Tone?]),
                      ...Object.entries(nginx.status24h ?? {}).map(([k, n]) => [`${k} (24 h)`, fmtNum(n)] as [string, React.ReactNode]),
                      ["Data sent (60 min)", fmtBytes(nginx.bytes60m)],
                      ["Open HTTPS connections", nginx.httpsConnections],
                      ["nginx error log (24 h)", fmtNum(nginx.errorLog24h), nginx.errorLog24h > 0 ? "warn" : undefined],
                    ]}
                  />
                </div>
                <DataTable maxHeight={260} rows={nginx.topPaths} columns={[{ key: "path", label: "Top paths (60 min)", className: "font-mono text-[11px] break-all" }, { key: "count", label: "Hits", align: "right" }]} />
                <DataTable
                  maxHeight={260}
                  rows={nginx.topClients}
                  columns={[
                    { key: "ip", label: "Top clients (60 min)", render: (r) => <span className="font-mono">{r.ip}{r.note && <span className="ml-1 text-muted-foreground font-sans">({r.note})</span>}</span> },
                    { key: "count", label: "Hits", align: "right" },
                  ]}
                />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                <div>
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">Recent server errors (5xx)</p>
                  <DataTable
                    maxHeight={220}
                    rows={[...(nginx.recent5xx ?? [])].reverse()}
                    empty="No 5xx responses in the last 24 h"
                    columns={[
                      { key: "time", label: "When", render: (r) => fmtDate(r.time) },
                      { key: "status", label: "Code", render: (r) => <Pill tone="bad">{r.status}</Pill> },
                      { key: "path", label: "Request", render: (r) => <span className="font-mono text-[11px] break-all">{r.method} {r.path}</span> },
                      { key: "ip", label: "Client", className: "font-mono" },
                    ]}
                  />
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">nginx error log (latest)</p>
                  <LogList lines={nginx.errorLogTail} empty="Empty" />
                </div>
              </div>
            </>
          )}
        </Panel>

        <Panel title="System" icon={Server}>
          <SectionError value={s.system} />
          <KV
            items={[
              ["Hostname", sys.hostname],
              ["Operating system", sys.os],
              ["Kernel", sys.kernel],
              ["CPU", sys.cpuModel ? `${sys.cpuModel} · ${sys.cores} vCPU` : "—"],
              ["IP addresses", (sys.ipAddresses ?? []).map((a: any) => `${a.address} (${a.iface})`).join(", ") || "—"],
              ["Processes", sys.processCount],
              ["Logged-in users", sys.loggedInUsers],
              ["Time sync (NTP)", sys.ntpSynchronized ? "Synchronised" : "Not synchronised", sys.ntpSynchronized ? "ok" : "warn"],
              ["Timezone", sys.timezone],
              ["Pending updates", sys.pendingUpdates !== undefined ? `${sys.pendingUpdates} (${sys.pendingSecurityUpdates ?? 0} security)` : "—", Number(sys.pendingSecurityUpdates) > 0 ? "warn" : undefined],
              ["Reboot required", sys.rebootRequired ? "Yes" : "No", sys.rebootRequired ? "warn" : "ok"],
              ["Collector run time", s.collectSeconds !== undefined ? `${s.collectSeconds} s` : "—"],
              ["Snapshot taken", collector.snapshotAt ? `${fmtDate(collector.snapshotAt)} (${fmtAgo(collector.snapshotAt)})` : "—", collector.stale ? "warn" : undefined],
            ]}
          />
        </Panel>

        <Panel title="Disks" icon={HardDrive}>
          <SectionError value={s.disks} />
          <DataTable
            rows={disks}
            columns={[
              { key: "mount", label: "Mount", className: "font-mono" },
              { key: "device", label: "Device", className: "font-mono text-[11px]" },
              { key: "fs", label: "FS" },
              { key: "total", label: "Size", align: "right", render: (r) => fmtBytes(r.total) },
              { key: "use", label: "Used", render: (r) => <Meter percent={r.percent} label={`${fmtPct(r.percent)} · ${fmtBytes(r.available)} free`} /> },
              { key: "inodesPercent", label: "Inodes", align: "right" },
            ]}
          />
          <p className="mt-3 mb-1 text-xs font-semibold text-muted-foreground">Disk usage trend (24 h)</p>
          <TimeArea data={historyChart} series={[{ key: "disk", label: "Root disk %", color: COLORS.violet }]} unit="%" height={120} />
        </Panel>

        <Panel title="Services" icon={ListChecks} subtitle={failedUnits.length ? `Failed units: ${failedUnits.join(", ")}` : "No failed systemd units"}>
          <SectionError value={s.services} />
          <DataTable
            rows={services}
            columns={[
              { key: "unit", label: "Service", render: (r) => <span className="inline-flex items-center gap-2 font-medium"><StatusDot tone={r.active === "active" ? "ok" : "bad"} pulse={r.active !== "active"} />{shortUnit(r.unit)}</span> },
              { key: "description", label: "Description", className: "text-muted-foreground max-w-[220px] truncate" },
              { key: "active", label: "State", render: (r) => `${r.active} (${r.sub})` },
              { key: "since", label: "Since", render: (r) => fmtAgo(r.since) },
              { key: "memoryBytes", label: "Memory", align: "right", render: (r) => (r.memoryBytes ? fmtBytes(r.memoryBytes) : "—") },
              { key: "restarts", label: "Restarts", align: "right", render: (r) => <span className={r.restarts > 0 ? "text-amber-500" : ""}>{r.restarts}</span> },
            ]}
          />
        </Panel>

        <Panel title="Scheduled jobs" icon={Timer} subtitle="systemd timers (Supabase sync, monitor collector)">
          <SectionError value={s.timers} />
          <DataTable
            rows={timers}
            columns={[
              { key: "timer", label: "Job", render: (r) => <span className="font-medium">{String(r.timer).replace(".timer", "").replace("talentscope-", "")}</span> },
              { key: "lastResult", label: "Last run", render: (r) => <Pill tone={r.running ? "info" : r.lastResult === "success" ? "ok" : "bad"}>{r.running ? "running" : r.lastResult}</Pill> },
              { key: "lastTrigger", label: "Ran", render: (r) => fmtAgo(r.lastTrigger) },
              { key: "next", label: "Next", render: (r) => fmtAgo(r.next) },
              { key: "runs", label: "Runs / fails 24 h", align: "right", render: (r) => <span className={r.failures24h ? "text-rose-500" : ""}>{r.runs24h} / {r.failures24h}</span> },
              { key: "lastSummary", label: "Last summary", className: "text-[11px] text-muted-foreground min-w-[200px]" },
            ]}
          />
          {timers.some((t) => t.recentErrors?.length) && (
            <div className="mt-3">
              <p className="mb-1 text-xs font-semibold text-muted-foreground">Recent job errors</p>
              <LogList lines={timers.flatMap((t) => (t.recentErrors ?? []).map((e: string) => `[${String(t.timer).replace(".timer", "")}] ${e}`))} />
            </div>
          )}
        </Panel>

        <Panel title="Docker" icon={Box} className="xl:col-span-2">
          <SectionError value={s.docker} />
          <DataTable
            rows={containers}
            columns={[
              { key: "name", label: "Container", render: (r) => <span className="inline-flex items-center gap-2 font-medium"><StatusDot tone={r.state === "running" ? "ok" : "muted"} />{r.name}</span> },
              { key: "image", label: "Image", className: "font-mono text-[11px]" },
              { key: "status", label: "Status" },
              { key: "cpu", label: "CPU", align: "right" },
              { key: "mem", label: "Memory", align: "right" },
              { key: "netIO", label: "Net I/O", align: "right" },
              { key: "blockIO", label: "Disk I/O", align: "right" },
              { key: "pids", label: "PIDs", align: "right" },
            ]}
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            <DataTable
              rows={s.docker?.diskUsage}
              columns={[
                { key: "type", label: "Docker disk usage" },
                { key: "count", label: "Count", align: "right" },
                { key: "active", label: "Active", align: "right" },
                { key: "size", label: "Size", align: "right" },
                { key: "reclaimable", label: "Reclaimable", align: "right" },
              ]}
            />
            <DataTable
              maxHeight={220}
              rows={s.docker?.images}
              columns={[
                { key: "repo", label: "Images", className: "font-mono text-[11px] break-all" },
                { key: "size", label: "Size", align: "right" },
                { key: "created", label: "Created" },
              ]}
            />
          </div>
          <p className="mt-4 mb-1 text-xs font-semibold text-muted-foreground">App container CPU & memory (24 h)</p>
          <TimeArea
            data={historyChart}
            series={[
              { key: "appCpu", label: "CPU %", color: COLORS.indigo },
              { key: "appMem", label: "Memory %", color: COLORS.emerald },
            ]}
            unit="%"
            height={150}
          />
        </Panel>

        <Panel title="App errors & warnings" icon={ScrollText} subtitle="From the app container log">
          <SectionError value={s.app} />
          {app && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                <StatCard label="Errors 60 min" value={fmtNum(app.errors60m)} tone={app.errors60m ? "bad" : "ok"} />
                <StatCard label="Warnings 60 min" value={fmtNum(app.warnings60m)} tone={app.warnings60m ? "warn" : "ok"} />
                <StatCard label="Errors 24 h" value={fmtNum(app.errors24h)} tone={app.errors24h ? "warn" : "ok"} />
                <StatCard label="Warnings 24 h" value={fmtNum(app.warnings24h)} />
              </div>
              <KV
                items={[
                  ["Container", app.name],
                  ["Started", `${fmtDate(app.startedAt)} (${fmtAgo(app.startedAt)})`],
                  ["Restarts", app.restarts, app.restarts > 0 ? "warn" : undefined],
                  ["Killed for memory", app.oomKilled ? "Yes" : "No", app.oomKilled ? "bad" : undefined],
                  ["Image", app.image],
                ]}
              />
              <p className="mt-3 mb-1 text-xs font-semibold text-muted-foreground">Last 60 minutes</p>
              <LogList lines={app.recentLog} empty="No errors or warnings in the last hour" />
            </>
          )}
        </Panel>

        <Panel title="AI services" icon={Bot} subtitle="Local models on the VM used by the app">
          <SectionError value={s.ai} />
          {ai && (
            <>
              <DataTable
                rows={ai.endpoints}
                columns={[
                  { key: "name", label: "Service", render: (r) => <span className="inline-flex items-center gap-2 font-medium"><StatusDot tone={r.ok ? "ok" : "bad"} />{r.name}</span> },
                  { key: "url", label: "Endpoint", className: "font-mono text-[11px]" },
                  { key: "status", label: "HTTP", render: (r) => r.status ?? r.error ?? "—" },
                  { key: "latencyMs", label: "Latency", align: "right", render: (r) => `${r.latencyMs} ms` },
                ]}
              />
              <div className="mt-3">
                <KV
                  items={[
                    ["Qwen context size", ai.qwen?.contextSize ? `${fmtNum(ai.qwen.contextSize)} tokens` : "—"],
                    ["Qwen requests (24 h)", fmtNum(ai.qwen?.requests24h)],
                    ["Rejected: prompt too long (24 h)", fmtNum(ai.qwen?.contextOverflow24h), ai.qwen?.contextOverflow24h ? "warn" : undefined],
                    ["Cancelled / timed out (24 h)", fmtNum(ai.qwen?.cancelled24h), ai.qwen?.cancelled24h ? "warn" : undefined],
                    ["Prompt reading speed", ai.qwen?.promptTokensPerSecond?.length ? `${ai.qwen.promptTokensPerSecond.slice(-3).join(", ")} tokens/s` : "—"],
                    ["Generation speed", ai.qwen?.generationTokensPerSecond?.length ? `${ai.qwen.generationTokensPerSecond.slice(-3).join(", ")} tokens/s` : "—"],
                  ]}
                />
              </div>
            </>
          )}
        </Panel>

        <Panel title="Load controls" icon={Bot} subtitle="Qwen queue, API concurrency and DB pool (live from the API process)">
          {runtime ? (
            <KV
              items={[
                ["Qwen busy / slots", `${runtime.llm?.active ?? 0} / ${runtime.llm?.slots ?? 1}`],
                ["Qwen queue", `${runtime.llm?.queued ?? 0} / ${runtime.llm?.maxQueue ?? 0}`, (runtime.llm?.queued ?? 0) > 0 ? "warn" : undefined],
                ["Qwen served", fmtNum(runtime.llm?.served)],
                ["Qwen average latency", runtime.llm?.avgLatencyS != null ? `${runtime.llm.avgLatencyS} s` : "—"],
                ["Rejected (queue full)", fmtNum(runtime.llm?.busy_rejected), runtime.llm?.busy_rejected ? "warn" : undefined],
                ["Timeouts", fmtNum(runtime.llm?.timeouts), runtime.llm?.timeouts ? "warn" : undefined],
                ["Prompts trimmed to fit context", fmtNum(runtime.llm?.oversize_trimmed)],
                ["Cache hits", fmtNum(runtime.llm?.cache_hits)],
                ["Circuit breaker", runtime.llm?.breakerOpen ? "open (using fallbacks)" : "closed", runtime.llm?.breakerOpen ? "bad" : undefined],
                ["Context window", runtime.llm?.contextTokens ? `${fmtNum(runtime.llm.contextTokens)} tokens` : "—"],
                ["API requests in flight", fmtNum(runtime.traffic?.inflight)],
                ["Rate-limit tracked clients", fmtNum(runtime.traffic?.trackedKeys)],
                ["DB pool in use / max", runtime.dbPool ? `${runtime.dbPool.inUse} / ${runtime.dbPool.max}` : "—"],
              ]}
            />
          ) : (
            <p className="text-xs text-muted-foreground">Runtime counters unavailable.</p>
          )}
        </Panel>

        <Panel title="TLS certificate" icon={ShieldCheck}>
          <SectionError value={s.tls} />
          {tls && (
            <KV
              items={[
                ["Subject", tls.subject],
                ["Issuer", tls.issuer],
                ["Names", (tls.names ?? []).join(", ")],
                ["Valid from", fmtDate(tls.validFrom)],
                ["Valid until", fmtDate(tls.validTo)],
                ["Days left", tls.daysLeft, certTone],
                ["File", <span key="p" className="font-mono text-[11px]">{tls.path}</span>],
              ]}
            />
          )}
        </Panel>

        <Panel title="Deployment" icon={GitCommit}>
          <SectionError value={s.deployment} />
          {deploy && (
            <KV
              items={[
                ["Live commit", deploy.commit ? <a key="c" className="font-mono text-primary hover:underline" href={`https://github.com/ics-anand-poc/talentscope/commit/${deploy.commit}`} target="_blank" rel="noreferrer">{deploy.commit}</a> : "—"],
                ["Deployed", deploy.deployedAt ? `${fmtDate(deploy.deployedAt)} (${fmtAgo(deploy.deployedAt)})` : "—"],
                ["Last GitHub runner job", deploy.lastRunnerJob ? `${fmtDate(deploy.lastRunnerJob)} (${fmtAgo(deploy.lastRunnerJob)})` : "—"],
                ["Runner jobs on record", deploy.runnerJobs ?? "—"],
              ]}
            />
          )}
        </Panel>

        <Panel title="Security" icon={KeyRound} className="xl:col-span-2">
          <SectionError value={s.security} />
          {sec && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <StatCard label="SSH logins 24 h" value={fmtNum(sec.sshAccepted24h)} />
                  <StatCard label="Failed SSH 24 h" value={fmtNum(sec.sshFailed24h)} tone={sec.sshFailed24h > 0 ? "warn" : "ok"} />
                  <StatCard label="sudo commands 24 h" value={fmtNum(sec.sudoCommands24h)} />
                  <StatCard label="Out-of-memory kills 7 d" value={fmtNum(sec.oomKills7d)} tone={sec.oomKills7d > 0 ? "bad" : "ok"} />
                </div>
                <KV items={[["Recent reboots", (sec.recentReboots ?? []).join(" · ") || "—"]]} />
                {sec.sshFailedTopIps?.length > 0 && (
                  <DataTable rows={sec.sshFailedTopIps} columns={[{ key: "ip", label: "Failed SSH from", className: "font-mono" }, { key: "count", label: "Attempts", align: "right" }]} />
                )}
              </div>
              <div className="lg:col-span-1">
                <DataTable
                  maxHeight={320}
                  rows={sec.recentLogins}
                  columns={[
                    { key: "user", label: "User" },
                    { key: "from", label: "From", className: "font-mono" },
                    { key: "login", label: "Login" },
                    { key: "until", label: "Until", render: (r) => (r.until === "logged in" || r.until?.startsWith("still") ? <Pill tone="info">logged in</Pill> : r.until) },
                  ]}
                />
              </div>
              <DataTable
                maxHeight={320}
                rows={(sec.listeningPorts ?? []).map(([address, process]: [string, string]) => ({ address, process }))}
                columns={[
                  { key: "address", label: "Listening on", className: "font-mono" },
                  { key: "process", label: "Process" },
                ]}
              />
            </div>
          )}
        </Panel>

        <Panel title="Top processes" icon={Activity}>
          <SectionError value={s.topCpu} />
          <DataTable
            rows={Array.isArray(s.topCpu) ? s.topCpu : []}
            columns={[
              { key: "command", label: "By CPU", className: "font-mono" },
              { key: "user", label: "User" },
              { key: "cpu", label: "CPU %", align: "right" },
              { key: "mem", label: "Mem %", align: "right" },
              { key: "rssBytes", label: "RSS", align: "right", render: (r) => fmtBytes(r.rssBytes) },
              { key: "uptimeSeconds", label: "Running", align: "right", render: (r) => fmtDuration(r.uptimeSeconds) },
            ]}
          />
          <div className="mt-3">
            <DataTable
              rows={Array.isArray(s.topMemory) ? s.topMemory : []}
              columns={[
                { key: "command", label: "By memory", className: "font-mono" },
                { key: "user", label: "User" },
                { key: "rssBytes", label: "RSS", align: "right", render: (r) => fmtBytes(r.rssBytes) },
                { key: "mem", label: "Mem %", align: "right" },
                { key: "cpu", label: "CPU %", align: "right" },
              ]}
            />
          </div>
        </Panel>

        <Panel title="System errors" icon={AlertTriangle} subtitle={journal ? `${journal.count24h} error entries in the system journal (24 h)${journal.ignoredNoise24h ? `, ${journal.ignoredNoise24h} routine Docker network messages hidden` : ""}` : undefined}>
          <SectionError value={s.journal} />
          <LogList lines={journal?.recent} empty="No system errors in the last 24 h" />
        </Panel>
      </div>
      {ageSeconds(collector.snapshotAt) !== null && (
        <p className="text-[11px] text-muted-foreground text-right">Collector snapshot {fmtAgo(collector.snapshotAt)} · {history.length} history points</p>
      )}
    </div>
  );
}
