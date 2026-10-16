"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Activity, Database, Loader2, RefreshCcw, Server, X } from "lucide-react";
import DbPanel from "./DbPanel";
import VmPanel from "./VmPanel";
import { buildHistoryPeriods, currentBlockId, fmtAgo } from "./ui";

type Target = "db" | "vm";
type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

const MAX_LIVE_POINTS = 240;
const REFRESH_OPTIONS: Array<[number, string]> = [
  [3600, "Every hour"],
  [900, "Every 15 min"],
  [300, "Every 5 min"],
  [60, "Every minute"],
  [0, "Manual"],
];

export default function SystemMonitor({ open, onClose, fetcher }: { open: boolean; onClose: () => void; fetcher: Fetcher }) {
  const [tab, setTab] = useState<Target>("db");
  const [data, setData] = useState<Record<Target, any>>({ db: null, vm: null });
  const [errors, setErrors] = useState<Record<Target, string | null>>({ db: null, vm: null });
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [refreshSeconds, setRefreshSeconds] = useState(3600);
  const [chosenPeriod, setChosenPeriod] = useState<string | null>(null);
  const [latencyHistory, setLatencyHistory] = useState<Array<{ t: string; ms: number }>>([]);
  const [liveHistory, setLiveHistory] = useState<Array<{ t: string; cpu: number; mem: number }>>([]);
  const [, setTick] = useState(0);
  const busy = useRef(false);

  const now = new Date();
  const periods = buildHistoryPeriods(now);
  const liveId = currentBlockId(now);
  const period = periods.find((p) => p.id === (chosenPeriod ?? liveId)) ?? periods[0];
  const { from: periodFrom, to: periodTo } = period;

  const load = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    const fetchOne = async (target: Target) => {
      try {
        const res = await fetcher(`/api/admin/monitor?target=${target}&from=${periodFrom}&to=${periodTo}`, { cache: "no-store" });
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
        return { target, body, error: null as string | null };
      } catch (err: unknown) {
        return { target, body: null, error: err instanceof Error ? err.message : String(err) };
      }
    };
    const results = await Promise.all([fetchOne("db"), fetchOne("vm")]);
    const now = new Date().toISOString();
    setData((prev) => {
      const next = { ...prev };
      for (const r of results) if (r.body) next[r.target] = r.body;
      return next;
    });
    setErrors({ db: results[0].error, vm: results[1].error });
    const dbBody = results[0].body;
    if (dbBody?.latency?.ok) {
      setLatencyHistory((h) => [...h, { t: now, ms: dbBody.latency.data.avgMs }].slice(-MAX_LIVE_POINTS));
    }
    const live = results[1].body?.live;
    if (live && !live.error) {
      setLiveHistory((h) => [...h, { t: live.at, cpu: live.cpuPercent, mem: live.memPercent }].slice(-MAX_LIVE_POINTS));
    }
    setUpdatedAt(now);
    setLoading(false);
    busy.current = false;
  }, [fetcher, periodFrom, periodTo]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  useEffect(() => {
    if (!open || !refreshSeconds) return;
    const id = window.setInterval(() => void load(), refreshSeconds * 1000);
    return () => window.clearInterval(id);
  }, [open, refreshSeconds, load]);

  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 5000);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearInterval(id);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const dbHost = data.db?.connection?.data?.server || "10.0.1.7";
  const vmHost = data.vm?.snapshot?.system?.ipAddresses?.[0]?.address?.split("/")[0] || "10.0.1.8";
  const tabs: Array<{ id: Target; label: string; host: string; icon: typeof Database }> = [
    { id: "db", label: "Database", host: dbHost, icon: Database },
    { id: "vm", label: "App server (VM)", host: vmHost, icon: Server },
  ];
  const current = data[tab];
  const currentError = errors[tab];

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-background/95 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="System monitor">
      <header className="border-b border-border/70 bg-card/90 px-4 md:px-6 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="app-brand-mark">
              <Activity className="h-[18px] w-[18px]" />
            </div>
            <div className="leading-tight">
              <p className="text-sm md:text-base font-bold text-foreground">System Monitor</p>
              <p className="text-[11px] text-muted-foreground">Usage, health and errors for the database server and the app server</p>
            </div>
          </div>

          <div className="flex rounded-xl border border-border/70 bg-muted/50 p-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs md:text-sm font-semibold transition-colors ${
                  tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
                <span className="hidden md:inline font-mono text-[11px] text-muted-foreground">{t.host}</span>
                {errors[t.id] && <span className="h-2 w-2 rounded-full bg-rose-500" />}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-xs text-muted-foreground">{updatedAt ? `Updated ${fmtAgo(updatedAt)}` : "Loading…"}</span>
            <select
              value={period.id}
              onChange={(e) => setChosenPeriod(e.target.value === liveId ? null : e.target.value)}
              className="h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground"
              aria-label="History period"
            >
              <optgroup label={`Today, ${now.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`}>
                {periods
                  .filter((p) => p.today)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      History: today {p.label}
                      {p.id === liveId ? " (now)" : ""}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Previous days">
                {periods
                  .filter((p) => !p.today)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      History: {p.label}
                    </option>
                  ))}
              </optgroup>
            </select>
            <select
              value={refreshSeconds}
              onChange={(e) => setRefreshSeconds(Number(e.target.value))}
              className="h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground"
              aria-label="Auto refresh"
            >
              {REFRESH_OPTIONS.map(([s, label]) => (
                <option key={s} value={s}>
                  {label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
              Refresh
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-foreground hover:bg-muted"
              aria-label="Close monitor"
              title="Close (Esc)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 md:px-6 py-5">
        <div className="mx-auto max-w-[1700px]">
          {currentError && (
            <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/5 px-4 py-2 text-sm text-rose-600 dark:text-rose-400">
              Could not refresh {tab === "db" ? "database" : "VM"} metrics: {currentError}
              {current ? " (showing the last good data)" : ""}
            </div>
          )}
          {!current && !currentError ? (
            <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Collecting metrics…
            </div>
          ) : tab === "db" ? (
            <DbPanel data={data.db} vm={data.vm} latencyHistory={latencyHistory} period={period.title} isLive={period.id === liveId} />
          ) : (
            <VmPanel data={data.vm} liveHistory={liveHistory} period={period.title} />
          )}
        </div>
      </main>
    </div>
  );
}
