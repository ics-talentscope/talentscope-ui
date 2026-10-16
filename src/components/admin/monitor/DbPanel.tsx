"use client";

import React, { useMemo, useState } from "react";
import {
  Activity,
  Archive,
  Clock,
  Cpu,
  Database,
  FileWarning,
  Gauge,
  HardDrive,
  History,
  Layers,
  ListChecks,
  Lock,
  RefreshCcw,
  Server,
  Table2,
  Timer,
  Users,
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
  Unavailable,
  ageSeconds,
  fmtAgo,
  fmtBytes,
  fmtDate,
  fmtDuration,
  fmtMb,
  fmtNum,
  fmtPct,
  toneFor,
  type Tone,
  historyNote,
} from "./ui";

type Sec<T = any> = { ok: boolean; data?: T; error?: string; needsPermission?: boolean } | undefined;

const ok = <T,>(s: Sec<T>): T | undefined => (s && s.ok ? (s.data as T) : undefined);

const DB_ERROR_RE = /mssql|tedious|RequestError|ConnectionError|ETIMEOUT|ESOCKET|deadlock|Login failed|SQL Server/i;

export default function DbPanel({
  data,
  vm,
  latencyHistory,
  period,
  isLive,
}: {
  data: any;
  vm: any;
  latencyHistory: Array<{ t: string; ms: number }>;
  period: string;
  isLive: boolean;
}) {
  const [tableSort, setTableSort] = useState<"size" | "rows" | "name">("size");

  const server = ok<any>(data?.server);
  const latency = ok<any>(data?.latency);
  const pool = ok<any>(data?.connection);
  const files = ok<any[]>(data?.files) ?? [];
  const log = ok<any>(data?.log);
  const tables = ok<any[]>(data?.tables) ?? [];
  const compare = ok<any>(data?.compare);
  const storage = ok<any[]>(data?.storage) ?? [];
  const backups = ok<any[]>(data?.backups) ?? [];
  const activity = ok<any>(data?.activity);
  const freshness = ok<any[]>(data?.freshness) ?? [];
  const migrations = ok<any[]>(data?.migrations) ?? [];
  const databases = ok<any[]>(data?.databases) ?? [];
  const indexes = ok<any[]>(data?.indexes) ?? [];
  const sl = data?.serverLevel ?? {};
  const login = server?.login ?? "TalentScopeAdmin";
  const grant = `GRANT VIEW SERVER PERFORMANCE STATE TO [${login}];`;
  const stored: any[] = data?.history?.points ?? [];
  const span = period;
  const showStored = stored.length > 0 || !isLive;
  const latencyChart = showStored ? stored.map((p) => ({ t: p.t, ms: p.latencyMs ?? null })) : latencyHistory;
  const failedPeriods = stored.filter((p) => Number(p.down) > 0).length;
  const hasServerHistory = stored.some((p) => p.sqlCpu != null || p.userConnections != null);

  const currentDb = databases.find((d) => d.name === server?.currentDb);
  const dataFiles = files.filter((f) => f.type === "ROWS");
  const logFiles = files.filter((f) => f.type === "LOG");
  const dataSize = dataFiles.reduce((s, f) => s + Number(f.sizeMb || 0), 0);
  const dataUsed = dataFiles.reduce((s, f) => s + Number(f.usedMb || 0), 0);
  const logSize = logFiles.reduce((s, f) => s + Number(f.sizeMb || 0), 0);
  const totalRows = tables.reduce((s, t) => s + Number(t.rowCount || 0), 0);
  const storageFiles = storage.reduce((s, b) => s + Number(b.files || 0), 0);
  const storageBytes = storage.reduce((s, b) => s + Number(b.bytes || 0), 0);

  const ownBackups = backups.filter((b) => b.databaseName === server?.currentDb);
  const lastFull = ownBackups.find((b) => b.type === "Full");
  const lastLog = ownBackups.find((b) => b.type === "Log");
  const fullAge = ageSeconds(lastFull?.finished);
  const backupTone: Tone = fullAge === null ? "bad" : fullAge > 14 * 86400 ? "bad" : fullAge > 7 * 86400 ? "warn" : "ok";

  const backupSummary = useMemo(() => {
    const byDb = new Map<string, any>();
    for (const b of backups) {
      const row = byDb.get(b.databaseName) ?? { databaseName: b.databaseName };
      if (!row[b.type]) row[b.type] = b;
      byDb.set(b.databaseName, row);
    }
    return [...byDb.values()];
  }, [backups]);

  const sortedTables = useMemo(() => {
    const list = [...tables];
    if (tableSort === "rows") list.sort((a, b) => Number(b.rowCount) - Number(a.rowCount));
    else if (tableSort === "name") list.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    return list;
  }, [tables, tableSort]);

  const compareRows = useMemo(() => {
    if (!compare?.tables) return [];
    const other = new Map<string, number>(compare.tables.map((t: any) => [t.name, Number(t.rowCount)]));
    const names = new Set<string>([...tables.map((t) => t.name), ...other.keys()]);
    return [...names]
      .map((name) => {
        const mine = tables.find((t) => t.name === name);
        const a = mine ? Number(mine.rowCount) : null;
        const b = other.has(name) ? other.get(name)! : null;
        return { name, mine: a, other: b, diff: a !== null && b !== null ? a - b : null };
      })
      .sort((x, y) => Math.abs(y.diff ?? 1e9) - Math.abs(x.diff ?? 1e9));
  }, [compare, tables]);

  const appDbErrors: string[] = (vm?.snapshot?.app?.recentLog ?? []).filter((l: string) => DB_ERROR_RE.test(l));
  const syncJobs: any[] = vm?.snapshot?.timers ?? [];

  const serverLevelSections = ["resources", "cpu", "waits", "sessions", "topQueries", "io", "volumes", "counters"] as const;
  const allLocked = serverLevelSections.every((k) => sl[k] && !sl[k].ok && sl[k].needsPermission);

  if (!data) return null;
  if (!data.configured || (data.connection && !data.connection.ok)) {
    return (
      <Panel title="Database connection" icon={Database}>
        <Unavailable section={data.connection} />
      </Panel>
    );
  }

  const latencyTone = toneFor(latency?.avgMs, 25, 150);
  const counters: Record<string, number> = Object.fromEntries((ok<any[]>(sl.counters) ?? []).map((c) => [c.counter, Number(c.value)]));
  const bufferHit = counters["Buffer cache hit ratio base"] ? (100 * counters["Buffer cache hit ratio"]) / counters["Buffer cache hit ratio base"] : null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        <StatCard label="Connection" value={latency ? `${latency.avgMs} ms` : "Connected"} sub={`Round trip to ${pool?.server ?? "server"}`} tone={latencyTone} icon={Activity} />
        <StatCard label="SQL Server" value={server?.machine ?? "—"} sub={`${server?.edition ?? ""} · ${server?.version ?? ""}`} tone="info" icon={Server} />
        <StatCard label="Database size" value={fmtMb(dataSize + logSize)} sub={`data ${fmtMb(dataSize)} · log ${fmtMb(logSize)}`} icon={HardDrive} />
        <StatCard
          label="Data file used"
          value={dataSize ? fmtPct((100 * dataUsed) / dataSize) : "—"}
          sub={`${fmtMb(dataUsed)} of ${fmtMb(dataSize)} allocated; grows automatically`}
          tone={toneFor(dataSize ? (100 * dataUsed) / dataSize : null, 97, 99.5)}
          icon={Gauge}
        />
        <StatCard
          label="Transaction log"
          value={log ? fmtPct(log.usedPercent) : "—"}
          sub={log ? `${fmtBytes(log.usedBytes)} used of ${fmtBytes(log.totalBytes)}${log.truncationHoldup ? ` · waiting on ${log.truncationHoldup}` : ""}` : "—"}
          tone={toneFor(log?.usedPercent, 70, 90)}
          icon={FileWarning}
        />
        <StatCard label="Rows" value={fmtNum(totalRows)} sub={`${tables.length} tables in ${server?.currentDb ?? "—"}`} icon={Table2} />
        <StatCard label="Stored files" value={fmtNum(storageFiles)} sub={`${fmtBytes(storageBytes)} on the API volume`} icon={Archive} />
        <StatCard
          label="Last full backup"
          value={lastFull ? fmtAgo(lastFull.finished) : "None found"}
          sub={lastFull ? `${fmtDate(lastFull.finished)} · ${fmtMb(lastFull.sizeMb)}` : "msdb has no full backup for this database"}
          tone={backupTone}
          icon={History}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Panel
          title={showStored ? `Connection latency (${span})` : "Connection latency"}
          icon={Activity}
          subtitle={
            showStored
              ? `SELECT 1 round trip from the app, recorded every minute even when this window is closed. ${historyNote(data.history)}`
              : "SELECT 1 round trip from the app container, sampled on every refresh while this window is open"
          }
        >
          <TimeArea data={latencyChart} series={[{ key: "ms", label: "Latency", color: COLORS.indigo }]} unit=" ms" height={170} />
          <div className="mt-3">
            <KV
              items={[
                ...(showStored
                  ? [[`Periods with failed checks (${span})`, `${failedPeriods} of ${stored.length}`, failedPeriods ? "bad" : "ok"] as [string, React.ReactNode, Tone]]
                  : []),
                ["Last samples", latency ? latency.samplesMs.map((v: number) => `${v} ms`).join(" · ") : "—"],
                ["Connection pool", pool ? `${pool.size ?? "?"} open · ${pool.available ?? "?"} idle · ${pool.borrowed ?? "?"} in use · max ${pool.max}` : "—"],
                ["Waiting for a connection", pool?.pending ?? "—", Number(pool?.pending) > 0 ? "warn" : undefined],
                ["Encryption", pool?.encrypt ? "TLS on" : "off", pool?.encrypt ? "ok" : "warn"],
                ["Clock difference (app − SQL)", server ? `${Math.round(Number(server.clockSkewMs) / 100) / 10} s` : "—", Math.abs(Number(server?.clockSkewMs)) > 5000 ? "warn" : undefined],
                ["Collected in", `${data.collectMs} ms`],
              ]}
            />
          </div>
        </Panel>

        <Panel title="Server & database" icon={Server}>
          <Unavailable section={data.server} />
          {server && (
            <KV
              items={[
                ["Server", `${server.machine} (${pool?.server}:${pool?.port})`],
                ["Product", server.versionLine],
                ["Edition", server.edition],
                ["Version", `${server.version} ${server.level ?? ""} ${server.updateLevel ?? ""}`.trim()],
                ["Host OS", server.host ? `${server.host.distribution}` : "—"],
                ["Database", server.currentDb],
                ["Recovery model", currentDb?.recovery ?? "—", currentDb?.recovery === "FULL" && !lastLog ? "warn" : undefined],
                ["Compatibility level", currentDb?.compat ?? "—"],
                ["Log reuse wait", currentDb?.logReuseWait ?? "—", currentDb?.logReuseWait && currentDb.logReuseWait !== "NOTHING" ? "warn" : undefined],
                ["Query Store", currentDb?.queryStore ? "On" : "Off"],
                ["Read committed snapshot", currentDb?.rcsi ? "On" : "Off"],
                ["Auto shrink / auto close", `${currentDb?.autoShrink ? "On" : "Off"} / ${currentDb?.autoClose ? "On" : "Off"}`, currentDb?.autoShrink || currentDb?.autoClose ? "warn" : undefined],
                ["Collation", server.collation],
                ["App login", server.login],
                ["db_owner", server.dbOwner ? "Yes" : "No"],
                ["Server-level metrics", server.viewServerState ? "Allowed" : "Not allowed (see below)", server.viewServerState ? "ok" : "warn"],
              ]}
            />
          )}
        </Panel>

        <Panel title={`Database size (${span})`} icon={HardDrive} subtitle={stored.length ? historyNote(data.history) : isLive ? "History starts recording once the app has been running for a minute" : "Nothing was recorded on this day"}>
          <TimeArea
            data={stored}
            series={[
              { key: "dataUsedMb", label: "Data used MB", color: COLORS.indigo },
              { key: "dataMb", label: "Data allocated MB", color: COLORS.slate },
              { key: "logMb", label: "Log file MB", color: COLORS.amber },
            ]}
            height={170}
          />
          <p className="mt-3 mb-1 text-xs font-semibold text-muted-foreground">Transaction log used ({span})</p>
          <TimeArea data={stored} series={[{ key: "logUsedPct", label: "Log used %", color: COLORS.rose }]} unit="%" yMax={100} height={110} />
        </Panel>

        <Panel title={`SQL Server load (${span})`} icon={Cpu} subtitle={hasServerHistory ? historyNote(data.history) : undefined}>
          {hasServerHistory ? (
            <>
              <TimeArea
                data={stored}
                series={[
                  { key: "sqlCpu", label: "SQL Server CPU %", color: COLORS.indigo },
                  { key: "otherCpu", label: "Other CPU %", color: COLORS.amber },
                ]}
                unit="%"
                yMax={100}
                stacked
                height={150}
              />
              <p className="mt-3 mb-1 text-xs font-semibold text-muted-foreground">Connections and activity ({span})</p>
              <TimeArea
                data={stored}
                series={[
                  { key: "userConnections", label: "User connections", color: COLORS.emerald },
                  { key: "batchPerSec", label: "Batch requests / s", color: COLORS.sky },
                  { key: "blocked", label: "Blocked processes", color: COLORS.rose },
                ]}
                height={150}
              />
            </>
          ) : (
            <>
              <TimeArea
                data={stored}
                series={[
                  { key: "poolInUse", label: "App connections in use", color: COLORS.emerald },
                  { key: "poolWaiting", label: "Waiting for a connection", color: COLORS.rose },
                ]}
                height={150}
              />
              <p className="mt-3 text-xs text-muted-foreground">
                SQL Server CPU, connections and batch requests are recorded too once the app login is granted{" "}
                <code className="font-mono text-[11px]">{grant}</code>
              </p>
            </>
          )}
        </Panel>

        <Panel title="Files & space" icon={HardDrive} className="xl:col-span-2" subtitle="Database files of the database the app uses">
          <Unavailable section={data.files} />
          <DataTable
            rows={files}
            columns={[
              { key: "name", label: "File" },
              { key: "type", label: "Type" },
              { key: "sizeMb", label: "Allocated", align: "right", render: (r) => fmtMb(r.sizeMb) },
              { key: "usedMb", label: "Used", align: "right", render: (r) => (r.usedMb === null ? "—" : fmtMb(r.usedMb)) },
              { key: "pct", label: "Usage", render: (r) => (r.usedMb === null ? "—" : <Meter percent={(100 * r.usedMb) / r.sizeMb} warn={97} bad={99.5} />) },
              { key: "growth", label: "Auto-growth" },
              { key: "maxMb", label: "Max size", render: (r) => (r.maxMb ? fmtMb(r.maxMb) : "Unlimited") },
              { key: "path", label: "Path", className: "font-mono text-[11px] break-all" },
            ]}
          />
          {log && (
            <div className="mt-4">
              <KV
                items={[
                  ["Log used", `${fmtBytes(log.usedBytes)} of ${fmtBytes(log.totalBytes)} (${fmtPct(log.usedPercent)})`, toneFor(log.usedPercent, 70, 90)],
                  ["Log written since last log backup", log.sinceLastBackupBytes !== undefined ? fmtBytes(log.sinceLastBackupBytes) : "—"],
                  ["Virtual log files", log.totalVlfs !== undefined ? `${log.totalVlfs} total · ${log.activeVlfs} active` : "—", Number(log.totalVlfs) > 1000 ? "warn" : undefined],
                  ["Truncation waiting on", log.truncationHoldup ?? "—", log.truncationHoldup && log.truncationHoldup !== "NOTHING" ? "warn" : undefined],
                  ["Last log backup", log.lastLogBackup && !String(log.lastLogBackup).startsWith("1900") ? fmtDate(log.lastLogBackup) : "Never", currentDb?.recovery === "FULL" ? "warn" : undefined],
                ]}
              />
            </div>
          )}
        </Panel>

        <Panel
          title="Tables"
          icon={Table2}
          className="xl:col-span-2"
          subtitle={`${tables.length} tables · ${fmtNum(totalRows)} rows`}
          right={
            <div className="flex gap-1 text-xs">
              {(["size", "rows", "name"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTableSort(k)}
                  className={`rounded-lg px-2 py-1 font-semibold ${tableSort === k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
                >
                  By {k}
                </button>
              ))}
            </div>
          }
        >
          <Unavailable section={data.tables} />
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Largest tables (MB reserved)</p>
              <Bars
                data={tables.slice(0, 10).map((t) => ({ name: t.name, mb: Math.round(Number(t.reservedMb) * 10) / 10 }))}
                series={[{ key: "mb", label: "MB", color: COLORS.indigo }]}
                xKey="name"
                horizontal
                height={300}
              />
            </div>
            <div className="lg:col-span-3">
              <DataTable
                maxHeight={320}
                rows={sortedTables}
                columns={[
                  { key: "name", label: "Table", render: (r) => <span className="font-medium">{r.name}</span> },
                  { key: "rowCount", label: "Rows", align: "right", render: (r) => fmtNum(r.rowCount) },
                  { key: "reservedMb", label: "Size", align: "right", render: (r) => fmtMb(r.reservedMb) },
                  { key: "dataMb", label: "Data", align: "right", render: (r) => fmtMb(r.dataMb) },
                  { key: "idx", label: "Indexes", align: "right", render: (r) => fmtMb(Math.max(0, Number(r.usedMb) - Number(r.dataMb))) },
                  { key: "indexCount", label: "#Idx", align: "right", render: (r) => (r.isHeap ? <Pill tone="warn">heap</Pill> : r.indexCount) },
                  { key: "statsUpdated", label: "Stats updated", render: (r) => fmtAgo(r.statsUpdated) },
                  { key: "modified", label: "Schema changed", render: (r) => fmtDate(r.modified) },
                ]}
              />
            </div>
          </div>
        </Panel>

        {compare && (
          <Panel title={`${server?.currentDb} vs ${compare.database}`} icon={Layers} subtitle="Row counts per table. The Supabase sync keeps the second database as a mirror; the app writes only to the first.">
            <DataTable
              maxHeight={340}
              rows={compareRows}
              columns={[
                { key: "name", label: "Table" },
                { key: "mine", label: server?.currentDb ?? "This DB", align: "right", render: (r) => fmtNum(r.mine) },
                { key: "other", label: compare.database, align: "right", render: (r) => fmtNum(r.other) },
                {
                  key: "diff",
                  label: "Difference",
                  align: "right",
                  render: (r) =>
                    r.diff === null ? <Pill tone="muted">only in one</Pill> : r.diff === 0 ? <span className="text-emerald-500">same</span> : <span className="text-amber-500">{r.diff > 0 ? "+" : ""}{fmtNum(r.diff)}</span>,
                },
              ]}
            />
          </Panel>
        )}

        <Panel title="File storage" icon={Archive} subtitle="Uploaded files kept on the API server disk (uploads volume)">
          <Unavailable section={data.storage} />
          <DataTable
            rows={storage}
            empty="No uploaded files yet"
            columns={[
              { key: "bucket", label: "Bucket", render: (r) => <span className="font-medium">{r.bucket}</span> },
              { key: "files", label: "Files", align: "right", render: (r) => fmtNum(r.files) },
              { key: "bytes", label: "Total", align: "right", render: (r) => fmtBytes(r.bytes) },
              { key: "avgBytes", label: "Average", align: "right", render: (r) => fmtBytes(r.avgBytes) },
              { key: "largestBytes", label: "Largest", align: "right", render: (r) => fmtBytes(r.largestBytes) },
              { key: "newest", label: "Last change", render: (r) => fmtAgo(r.newest) },
            ]}
          />
          {storage.length > 0 && (
            <div className="mt-3">
              <Bars data={storage.map((b) => ({ bucket: b.bucket, mb: Math.round(Number(b.bytes) / 104857.6) / 10 }))} series={[{ key: "mb", label: "MB", color: COLORS.violet }]} xKey="bucket" height={160} />
            </div>
          )}
        </Panel>

        <Panel title="Backups" icon={History} subtitle="From msdb backup history on the SQL Server">
          <Unavailable section={data.backups} />
          <DataTable
            rows={backupSummary}
            empty="No backups recorded in msdb"
            columns={[
              { key: "databaseName", label: "Database", render: (r) => <span className="font-medium">{r.databaseName}</span> },
              { key: "Full", label: "Last full", render: (r) => (r.Full ? `${fmtAgo(r.Full.finished)} · ${fmtMb(r.Full.sizeMb)}` : <Pill tone="bad">none</Pill>) },
              { key: "Differential", label: "Last differential", render: (r) => (r.Differential ? fmtAgo(r.Differential.finished) : "—") },
              { key: "Log", label: "Last log", render: (r) => (r.Log ? fmtAgo(r.Log.finished) : "—") },
            ]}
          />
          <p className="mt-3 mb-1 text-xs font-semibold text-muted-foreground">Recent backups</p>
          <DataTable
            maxHeight={200}
            rows={backups.slice(0, 15)}
            columns={[
              { key: "finished", label: "Finished", render: (r) => fmtDate(r.finished) },
              { key: "databaseName", label: "Database" },
              { key: "type", label: "Type" },
              { key: "sizeMb", label: "Size", align: "right", render: (r) => fmtMb(r.sizeMb) },
              { key: "seconds", label: "Took", align: "right", render: (r) => fmtDuration(r.seconds) },
              { key: "copyOnly", label: "Copy-only", render: (r) => (r.copyOnly ? "yes" : "") },
            ]}
          />
        </Panel>

        <Panel title="App activity" icon={Users} subtitle="From dbo.audit_logs: what the app has been doing">
          <Unavailable section={data.activity} />
          {activity ? (
            <>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <StatCard label="Last hour" value={fmtNum(activity.lastHour)} />
                <StatCard label="Last 24 h" value={fmtNum(activity.last24h)} />
                <StatCard label="Failures 24 h" value={fmtNum(activity.failures24h)} tone={Number(activity.failures24h) > 20 ? "warn" : "muted"} />
              </div>
              <Bars
                data={activity.perDay}
                series={[
                  { key: "total", label: "Events", color: COLORS.indigo },
                  { key: "failures", label: "Failures", color: COLORS.rose },
                ]}
                xKey="day"
                height={170}
                xFormatter={(d) => String(d).slice(5)}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                <DataTable maxHeight={220} rows={activity.byAction} columns={[{ key: "action", label: "Action (24 h)" }, { key: "count", label: "Count", align: "right" }]} />
                <DataTable
                  maxHeight={220}
                  rows={activity.recentFailures}
                  empty="No failures"
                  columns={[
                    { key: "at", label: "When", render: (r) => fmtAgo(r.at) },
                    { key: "action", label: "Failure" },
                    { key: "actor", label: "Who" },
                  ]}
                />
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No audit_logs table</p>
          )}
        </Panel>

        <Panel title="Data freshness" icon={Clock} subtitle="Newest row in each key table">
          <Unavailable section={data.freshness} />
          <DataTable
            rows={freshness}
            columns={[
              { key: "label", label: "Data" },
              { key: "table", label: "Table", className: "font-mono text-[11px]" },
              { key: "newest", label: "Newest row", render: (r) => fmtDate(r.newest) },
              { key: "age", label: "Age", render: (r) => fmtAgo(r.newest) },
            ]}
          />
        </Panel>

        <Panel title="Sync jobs writing to this server" icon={RefreshCcw} subtitle="Supabase → SQL Server timers on the VM (app-* jobs write to the app database)">
          {syncJobs.length ? (
            <DataTable
              rows={syncJobs.filter((t) => String(t.timer).includes("db-sync"))}
              columns={[
                { key: "timer", label: "Job", render: (r) => <span className="font-medium">{String(r.timer).replace("talentscope-db-sync-", "").replace(".timer", "")}</span> },
                { key: "state", label: "State", render: (r) => <span className="inline-flex items-center gap-1.5"><StatusDot tone={r.enabled === "enabled" ? "ok" : "muted"} />{r.enabled}</span> },
                { key: "lastResult", label: "Last run", render: (r) => <Pill tone={r.lastResult === "success" ? "ok" : "bad"}>{r.running ? "running" : r.lastResult}</Pill> },
                { key: "lastTrigger", label: "When", render: (r) => fmtAgo(r.lastTrigger) },
                { key: "runs", label: "Runs / fails 24 h", align: "right", render: (r) => `${r.runs24h} / ${r.failures24h}` },
                { key: "lastSummary", label: "Last result", className: "text-[11px] text-muted-foreground" },
              ]}
            />
          ) : (
            <p className="text-sm text-muted-foreground">VM collector data not available</p>
          )}
        </Panel>

        <Panel title="Database errors seen by the app" icon={FileWarning} subtitle="SQL-related lines from the app container log, last 60 minutes">
          <LogList lines={appDbErrors} empty={vm?.snapshot ? "No database errors in the last hour" : "VM collector data not available"} />
        </Panel>

        <Panel title="Index health" icon={ListChecks} subtitle="Fragmentation of indexes larger than 50 pages">
          <Unavailable section={data.indexes} />
          <DataTable
            rows={indexes}
            maxHeight={260}
            columns={[
              { key: "tableName", label: "Table" },
              { key: "indexName", label: "Index", render: (r) => r.indexName ?? <Pill tone="warn">heap</Pill> },
              { key: "fragmentation", label: "Fragmentation", render: (r) => <Meter percent={r.fragmentation} warn={30} bad={60} /> },
              { key: "pages", label: "Pages", align: "right", render: (r) => fmtNum(r.pages) },
            ]}
          />
        </Panel>

        <Panel title="Databases on this server" icon={Database}>
          <Unavailable section={data.databases} />
          <DataTable
            rows={databases}
            columns={[
              { key: "name", label: "Name", render: (r) => <span className={r.name === server?.currentDb ? "font-bold text-primary" : ""}>{r.name}</span> },
              { key: "state", label: "State", render: (r) => <Pill tone={r.state === "ONLINE" ? "ok" : "bad"}>{r.state}</Pill> },
              { key: "recovery", label: "Recovery" },
              { key: "compat", label: "Compat", align: "right" },
              { key: "logReuseWait", label: "Log reuse wait" },
              { key: "created", label: "Created", render: (r) => fmtDate(r.created) },
            ]}
          />
        </Panel>

        <Panel title="Schema migrations" icon={Layers} subtitle="dbo.__migrations">
          <Unavailable section={data.migrations} />
          <DataTable rows={migrations} columns={[{ key: "filename", label: "File", className: "font-mono text-[11px]" }, { key: "appliedAt", label: "Applied", render: (r) => fmtDate(r.appliedAt) }]} />
        </Panel>
      </div>

      <div className="pt-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-foreground mb-3">
          <Cpu className="h-4 w-4 text-primary" /> SQL Server instance performance
        </h3>
        {allLocked ? (
          <Panel title="Instance metrics are locked" icon={Lock} subtitle="CPU, memory, waits, sessions, top queries, I/O latency, disk volumes and counters for the whole SQL Server">
            <Unavailable section={sl.resources} grant={grant} />
            <p className="mt-3 text-xs text-muted-foreground">
              Once granted, these sections fill in automatically on the next refresh. Reading the SQL Server error log additionally needs the
              login to be in the <code>securityadmin</code> role (optional).
            </p>
          </Panel>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <Panel title="CPU" icon={Cpu} subtitle="SQL Server process vs other processes on the host (last 60 min)">
              <Unavailable section={sl.cpu} grant={grant} />
              {ok<any[]>(sl.cpu) && (
                <TimeArea
                  data={[...(ok<any[]>(sl.cpu) ?? [])].reverse()}
                  series={[
                    { key: "sql", label: "SQL Server", color: COLORS.indigo },
                    { key: "other", label: "Other", color: COLORS.amber },
                  ]}
                  unit="%"
                  yMax={100}
                  stacked
                />
              )}
            </Panel>
            <Panel title="Memory" icon={Gauge}>
              <Unavailable section={sl.resources} grant={grant} />
              {ok<any>(sl.resources) && (() => {
                const r = ok<any>(sl.resources);
                return (
                  <KV
                    items={[
                      ["CPUs", r.cpus],
                      ["Host memory", `${fmtBytes(r.memory?.totalKb * 1024)} total · ${fmtBytes(r.memory?.availableKb * 1024)} free`],
                      ["Memory state", r.memory?.state],
                      ["SQL Server using", fmtBytes(r.process?.inUseKb * 1024)],
                      ["Committed / target", `${fmtBytes(r.committedKb * 1024)} / ${fmtBytes(r.targetKb * 1024)}`],
                      ["Page life expectancy", counters["Page life expectancy"] ? `${fmtNum(counters["Page life expectancy"])} s` : "—", toneFor(counters["Page life expectancy"], 600, 300, false)],
                      ["Buffer cache hit ratio", bufferHit !== null ? fmtPct(bufferHit) : "—"],
                      ["Memory grants pending", counters["Memory Grants Pending"] ?? "—", Number(counters["Memory Grants Pending"]) > 0 ? "warn" : undefined],
                      ["SQL Server started", `${fmtDate(r.startedAt)} (${fmtAgo(r.startedAt)})`],
                    ]}
                  />
                );
              })()}
            </Panel>
            <Panel title="Wait statistics" icon={Timer} subtitle="What SQL Server spends time waiting on since start">
              <Unavailable section={sl.waits} grant={grant} />
              <DataTable
                rows={ok<any[]>(sl.waits)}
                columns={[
                  { key: "waitType", label: "Wait type", className: "font-mono text-[11px]" },
                  { key: "pct", label: "Share", render: (r) => <Meter percent={r.pct} warn={101} bad={101} /> },
                  { key: "waitMs", label: "Total", align: "right", render: (r) => fmtDuration(Number(r.waitMs) / 1000) },
                  { key: "tasks", label: "Waits", align: "right", render: (r) => fmtNum(r.tasks) },
                ]}
              />
            </Panel>
            <Panel title="Sessions" icon={Users} subtitle={ok<any>(sl.sessions) ? `${ok<any>(sl.sessions).total} user sessions · ${ok<any>(sl.sessions).blocked} blocked` : undefined}>
              <Unavailable section={sl.sessions} grant={grant} />
              <DataTable
                rows={ok<any>(sl.sessions)?.list}
                columns={[
                  { key: "id", label: "SPID", align: "right" },
                  { key: "login", label: "Login" },
                  { key: "host", label: "Host" },
                  { key: "program", label: "Program", className: "max-w-[160px] truncate" },
                  { key: "db", label: "DB" },
                  { key: "status", label: "Status" },
                  { key: "blockedBy", label: "Blocked by", render: (r) => (Number(r.blockedBy) > 0 ? <Pill tone="bad">{r.blockedBy}</Pill> : "") },
                  { key: "cpuMs", label: "CPU", align: "right", render: (r) => `${fmtNum(r.cpuMs)} ms` },
                ]}
              />
            </Panel>
            <Panel title="Most expensive queries" icon={Activity} className="xl:col-span-2" subtitle="By total CPU since they entered the plan cache">
              <Unavailable section={sl.topQueries} grant={grant} />
              <DataTable
                rows={ok<any[]>(sl.topQueries)}
                columns={[
                  { key: "executions", label: "Runs", align: "right", render: (r) => fmtNum(r.executions) },
                  { key: "totalCpuMs", label: "Total CPU", align: "right", render: (r) => fmtDuration(Number(r.totalCpuMs) / 1000) },
                  { key: "avgCpuMs", label: "Avg CPU", align: "right", render: (r) => `${Number(r.avgCpuMs).toFixed(1)} ms` },
                  { key: "avgElapsedMs", label: "Avg time", align: "right", render: (r) => `${Number(r.avgElapsedMs).toFixed(1)} ms` },
                  { key: "avgReads", label: "Avg reads", align: "right", render: (r) => fmtNum(r.avgReads) },
                  { key: "db", label: "DB" },
                  { key: "sqlText", label: "Query", className: "font-mono text-[11px] break-all min-w-[320px]" },
                ]}
              />
            </Panel>
            <Panel title="File I/O latency" icon={HardDrive}>
              <Unavailable section={sl.io} grant={grant} />
              <DataTable
                rows={ok<any[]>(sl.io)}
                columns={[
                  { key: "db", label: "DB" },
                  { key: "fileName", label: "File" },
                  { key: "readLatencyMs", label: "Read ms", align: "right", render: (r) => <span className={toneFor(r.readLatencyMs, 20, 50) === "ok" ? "" : "text-amber-500"}>{r.readLatencyMs ?? "—"}</span> },
                  { key: "writeLatencyMs", label: "Write ms", align: "right", render: (r) => <span className={toneFor(r.writeLatencyMs, 20, 50) === "ok" ? "" : "text-amber-500"}>{r.writeLatencyMs ?? "—"}</span> },
                  { key: "readMb", label: "Read", align: "right", render: (r) => fmtMb(r.readMb) },
                  { key: "writtenMb", label: "Written", align: "right", render: (r) => fmtMb(r.writtenMb) },
                ]}
              />
            </Panel>
            <Panel title="Disk volumes on the SQL Server" icon={HardDrive}>
              <Unavailable section={sl.volumes} grant={grant} />
              <DataTable
                rows={ok<any[]>(sl.volumes)}
                columns={[
                  { key: "mount", label: "Volume" },
                  { key: "label", label: "Label" },
                  { key: "totalBytes", label: "Size", align: "right", render: (r) => fmtBytes(r.totalBytes) },
                  { key: "use", label: "Used", render: (r) => <Meter percent={100 - (100 * r.availableBytes) / r.totalBytes} label={`${fmtBytes(r.availableBytes)} free`} /> },
                ]}
              />
            </Panel>
          </div>
        )}
        <div className="mt-5">
          <Panel title="SQL Server error log" icon={FileWarning} subtitle="Errors and failures from the current error log">
            {sl.errorLog && !sl.errorLog.ok ? (
              <Unavailable
                section={{ ...sl.errorLog, needsPermission: true }}
                grant={`ALTER SERVER ROLE securityadmin ADD MEMBER [${login}];  -- optional, gives the login security-admin rights`}
              />
            ) : (
              <DataTable
                rows={ok<any[]>(sl.errorLog)}
                empty="No errors in the current log"
                columns={[
                  { key: "at", label: "When", render: (r) => fmtDate(r.at) },
                  { key: "source", label: "Source" },
                  { key: "text", label: "Message", className: "break-words" },
                ]}
              />
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
