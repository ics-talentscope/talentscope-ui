"use client";

import React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Lock } from "lucide-react";

export type Tone = "ok" | "warn" | "bad" | "muted" | "info";

export const COLORS = {
  indigo: "#6366f1",
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
  sky: "#0ea5e9",
  violet: "#8b5cf6",
  slate: "#94a3b8",
};

const TONE_TEXT: Record<Tone, string> = {
  ok: "text-emerald-500",
  warn: "text-amber-500",
  bad: "text-rose-500",
  muted: "text-muted-foreground",
  info: "text-sky-500",
};
const TONE_BG: Record<Tone, string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  bad: "bg-rose-500",
  muted: "bg-slate-400",
  info: "bg-sky-500",
};
const TONE_SOFT: Record<Tone, string> = {
  ok: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  warn: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
  bad: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
  muted: "bg-muted text-muted-foreground border-border",
  info: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30",
};

/* ---------------- formatting ---------------- */

export function fmtBytes(bytes: unknown, digits = 1): string {
  const n = Number(bytes);
  if (!Number.isFinite(n)) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = Math.abs(n);
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${n < 0 ? "-" : ""}${v.toFixed(i === 0 ? 0 : digits)} ${units[i]}`;
}

export const fmtMb = (mb: unknown) => (Number.isFinite(Number(mb)) ? fmtBytes(Number(mb) * 1048576) : "—");

export function fmtNum(n: unknown): string {
  const v = Number(n);
  return Number.isFinite(v) ? v.toLocaleString() : "—";
}

export function fmtPct(n: unknown, digits = 1): string {
  const v = Number(n);
  return Number.isFinite(v) ? `${v.toFixed(digits)}%` : "—";
}

export function fmtDuration(seconds: unknown): string {
  const s = Number(seconds);
  if (!Number.isFinite(s)) return "—";
  if (s < 60) return `${Math.round(s)}s`;
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m ${Math.round(s % 60)}s`;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  const s = String(value);
  const d = new Date(/^\d{10}(\.\d+)?$/.test(s) ? Number(s) * 1000 : s.replace(/ UTC$/, "Z"));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fmtDate(value: unknown): string {
  const d = toDate(value);
  return d ? d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : value ? String(value) : "—";
}

export function fmtAgo(value: unknown): string {
  const d = toDate(value);
  if (!d) return "—";
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 0) return `in ${fmtDuration(-diff)}`;
  if (diff < 45) return "just now";
  return `${fmtDuration(diff)} ago`;
}

export function ageSeconds(value: unknown): number | null {
  const d = toDate(value);
  return d ? (Date.now() - d.getTime()) / 1000 : null;
}

export function toneFor(value: unknown, warn: number, bad: number, higherIsWorse = true): Tone {
  const v = Number(value);
  if (!Number.isFinite(v)) return "muted";
  if (higherIsWorse) return v >= bad ? "bad" : v >= warn ? "warn" : "ok";
  return v <= bad ? "bad" : v <= warn ? "warn" : "ok";
}

export const timeLabel = (iso: unknown) => {
  const d = toDate(iso);
  return d ? d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "";
};

const dayTimeLabel = (iso: unknown) => {
  const d = toDate(iso);
  return d ? d.toLocaleString(undefined, { weekday: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
};

export type HistoryPeriod = { id: string; label: string; title: string; today: boolean; from: number; to: number };

const BLOCK_HOURS = 6;
const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;

export const currentBlockId = (now = new Date()) => `today-${Math.floor(now.getHours() / BLOCK_HOURS)}`;

/** Today's 6-hour blocks that have started (newest first), then each previous day as a whole day, in the viewer's time zone. */
export function buildHistoryPeriods(now = new Date(), days = 7): HistoryPeriod[] {
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const periods: HistoryPeriod[] = [];
  for (let i = 24 / BLOCK_HOURS - 1; i >= 0; i--) {
    const start = new Date(midnight);
    start.setHours(i * BLOCK_HOURS);
    if (start > now) continue;
    const end = new Date(midnight);
    end.setHours((i + 1) * BLOCK_HOURS);
    const label = `${hourLabel(i * BLOCK_HOURS)}–${hourLabel((i + 1) * BLOCK_HOURS)}`;
    periods.push({ id: `today-${i}`, label, title: `today ${label}`, today: true, from: start.getTime() / 1000, to: end.getTime() / 1000 });
  }
  for (let d = 1; d <= days; d++) {
    const start = new Date(midnight);
    start.setDate(midnight.getDate() - d);
    const end = new Date(midnight);
    end.setDate(midnight.getDate() - d + 1);
    const label = start.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
    periods.push({ id: `day-${d}`, label, title: label, today: false, from: start.getTime() / 1000, to: end.getTime() / 1000 });
  }
  return periods;
}

/** Subtitle for charts drawn from the stored history. */
export function historyNote(
  history: { bucketSeconds?: number; from?: string; oldestAt?: string | null; retentionDays?: number } | undefined,
) {
  if (!history) return undefined;
  const step = Number(history.bucketSeconds) >= 3600 ? "Hourly averages" : `${Math.round(Number(history.bucketSeconds || 60) / 60)}-minute averages`;
  const partial =
    history.oldestAt && history.from && new Date(history.oldestAt) > new Date(history.from) ? ` · recording started ${fmtDate(history.oldestAt)}` : "";
  return `${step} · kept ${history.retentionDays ?? 7} days${partial}`;
}

/* ---------------- building blocks ---------------- */

export function StatusDot({ tone, pulse = false }: { tone: Tone; pulse?: boolean }) {
  return (
    <span className="relative inline-flex h-2.5 w-2.5 shrink-0">
      {pulse && <span className={`absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping ${TONE_BG[tone]}`} />}
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${TONE_BG[tone]}`} />
    </span>
  );
}

export function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TONE_SOFT[tone]}`}>{children}</span>;
}

export function StatCard({
  label,
  value,
  sub,
  tone = "muted",
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: Tone;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        {Icon ? <Icon className={`h-4 w-4 ${TONE_TEXT[tone]}`} /> : <StatusDot tone={tone} />}
      </div>
      <p className={`mt-2 text-xl font-bold tracking-tight ${tone === "muted" ? "text-foreground" : TONE_TEXT[tone]}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground leading-snug">{sub}</p>}
    </div>
  );
}

export function Panel({
  title,
  icon: Icon,
  subtitle,
  right,
  children,
  className = "",
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-border/70 bg-card shadow-sm flex flex-col min-w-0 ${className}`}>
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-border/60 px-4 py-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
            {Icon && <Icon className="h-4 w-4 text-primary" />}
            {title}
          </h3>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {right}
      </header>
      <div className="p-4 min-w-0 flex-1">{children}</div>
    </section>
  );
}

export function KV({ items }: { items: Array<[string, React.ReactNode, Tone?]> }) {
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
      {items.map(([k, v, tone]) => (
        <div key={k} className="flex items-baseline justify-between gap-3 border-b border-border/40 pb-1.5 min-w-0">
          <dt className="text-muted-foreground text-xs shrink-0">{k}</dt>
          <dd className={`text-right font-medium break-words min-w-0 ${tone ? TONE_TEXT[tone] : "text-foreground"}`}>{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Meter({ percent, warn = 75, bad = 90, label }: { percent: unknown; warn?: number; bad?: number; label?: React.ReactNode }) {
  const v = Math.max(0, Math.min(100, Number(percent) || 0));
  const tone = toneFor(v, warn, bad);
  return (
    <div className="min-w-[90px]">
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${TONE_BG[tone]} transition-all`} style={{ width: `${v}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">{label ?? fmtPct(v)}</p>
    </div>
  );
}

export type Column<T> = {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  render?: (row: T) => React.ReactNode;
  className?: string;
};

const ALIGN = { left: "text-left", right: "text-right", center: "text-center" } as const;

export function DataTable<T extends Record<string, any>>({
  columns,
  rows,
  empty = "Nothing to show",
  maxHeight = 360,
  onRowClick,
  rowClassName,
}: {
  columns: Column<T>[];
  rows: T[] | null | undefined;
  empty?: string;
  maxHeight?: number;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string;
}) {
  if (!rows || rows.length === 0) return <p className="text-sm text-muted-foreground py-2">{empty}</p>;
  return (
    <div className="overflow-auto rounded-xl border border-border/60" style={{ maxHeight }}>
      <table className="w-full text-xs">
        <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={`px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap ${ALIGN[c.align ?? "left"]}`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`border-t border-border/40 hover:bg-muted/40 ${onRowClick ? "cursor-pointer" : ""} ${rowClassName ? rowClassName(row) : ""}`}
            >
              {columns.map((c) => (
                <td key={c.key} className={`px-3 py-1.5 align-top ${ALIGN[c.align ?? "left"]} ${c.className ?? ""}`}>
                  {c.render ? c.render(row) : row[c.key] === null || row[c.key] === undefined ? "—" : String(row[c.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LogList({ lines, empty = "No entries" }: { lines: string[] | null | undefined; empty?: string }) {
  if (!lines || lines.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <pre className="max-h-72 overflow-auto rounded-xl border border-border/60 bg-muted/40 p-3 text-[11px] leading-relaxed whitespace-pre-wrap break-all font-mono text-foreground/90">
      {lines.join("\n")}
    </pre>
  );
}

type SectionLike = { ok: boolean; data?: unknown; error?: string; needsPermission?: boolean } | undefined | null;

export function Unavailable({ section, grant }: { section: SectionLike; grant?: string }) {
  if (!section || section.ok) return null;
  if (section.needsPermission) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs space-y-2">
        <p className="flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400">
          <Lock className="h-3.5 w-3.5" /> The app&apos;s SQL login is not allowed to read this
        </p>
        {grant && (
          <>
            <p className="text-muted-foreground">A DBA can enable it on the SQL Server with:</p>
            <code className="block rounded-lg bg-muted px-2 py-1.5 font-mono text-[11px] text-foreground break-all">{grant}</code>
          </>
        )}
        <p className="text-muted-foreground break-words">{section.error}</p>
      </div>
    );
  }
  return <p className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 text-xs text-rose-600 dark:text-rose-400 break-words">{section.error}</p>;
}

/* ---------------- charts ---------------- */

export type Series = { key: string; label: string; color: string };

const axisTick = { fill: "currentColor", fontSize: 10 };

export function TimeArea({
  data,
  series,
  height = 180,
  unit = "",
  yMax,
  stacked = false,
  xKey = "t",
}: {
  data: Array<Record<string, any>>;
  series: Series[];
  height?: number;
  unit?: string;
  yMax?: number;
  stacked?: boolean;
  xKey?: string;
}) {
  if (!data?.length) return <p className="text-sm text-muted-foreground">No data recorded for this period yet</p>;
  const first = toDate(data[0][xKey]);
  const last = toDate(data[data.length - 1][xKey]);
  const tickFormatter = first && last && last.getTime() - first.getTime() > 86400_000 ? dayTimeLabel : timeLabel;
  return (
    <div className="text-muted-foreground" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.12} />
          <XAxis dataKey={xKey} tick={axisTick} tickFormatter={tickFormatter} minTickGap={40} stroke="currentColor" strokeOpacity={0.3} />
          <YAxis tick={axisTick} domain={[0, yMax ?? "auto"]} stroke="currentColor" strokeOpacity={0.3} unit={unit} width={52} />
          <Tooltip
            contentStyle={{ background: "var(--popover, #111827)", border: "1px solid rgba(148,163,184,.3)", borderRadius: 10, fontSize: 12 }}
            labelFormatter={(l) => fmtDate(l)}
            formatter={(v, name) => [`${typeof v === "number" ? Math.round(v * 10) / 10 : v}${unit}`, String(name)]}
          />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
          {series.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              fill={`url(#g-${s.key})`}
              strokeWidth={1.8}
              stackId={stacked ? "1" : undefined}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Bars({
  data,
  series,
  xKey,
  height = 200,
  stacked = false,
  horizontal = false,
  xFormatter,
}: {
  data: Array<Record<string, any>>;
  series: Series[];
  xKey: string;
  height?: number;
  stacked?: boolean;
  horizontal?: boolean;
  xFormatter?: (v: any) => string;
}) {
  if (!data?.length) return <p className="text-sm text-muted-foreground">No data</p>;
  return (
    <div className="text-muted-foreground" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 4, right: 8, left: horizontal ? 8 : -14, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.12} />
          {horizontal ? (
            <>
              <XAxis type="number" tick={axisTick} stroke="currentColor" strokeOpacity={0.3} />
              <YAxis type="category" dataKey={xKey} tick={axisTick} width={130} stroke="currentColor" strokeOpacity={0.3} />
            </>
          ) : (
            <>
              <XAxis dataKey={xKey} tick={axisTick} tickFormatter={xFormatter} minTickGap={20} stroke="currentColor" strokeOpacity={0.3} />
              <YAxis tick={axisTick} stroke="currentColor" strokeOpacity={0.3} width={48} allowDecimals={false} />
            </>
          )}
          <Tooltip
            cursor={{ fill: "rgba(148,163,184,.12)" }}
            contentStyle={{ background: "var(--popover, #111827)", border: "1px solid rgba(148,163,184,.3)", borderRadius: 10, fontSize: 12 }}
            labelFormatter={(l) => (xFormatter ? xFormatter(l) : String(l))}
          />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} stackId={stacked ? "1" : undefined} radius={stacked ? 0 : 3} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
