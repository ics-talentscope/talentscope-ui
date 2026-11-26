"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ClipboardList,
  Layers,
  Loader2,
  Plus,
  Trash2,
  Trophy,
  Upload,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

type Step = "cohort" | "learners" | "assessments" | "progress";

type LearnerInput = { employeeId: string; name: string; email: string; role: string };

type EnrollResult = {
  created: number;
  existing: number;
  enrolled: { employeeId: string; name: string; created: boolean; firstLoginPassword?: string | null; assigned: number }[];
  failed: { row: number; employeeId: string; error: string }[];
};

const BASE = "/api/admin/slalom/bootcamp";

const STEPS: { key: Step; label: string; hint: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "cohort", label: "Cohort", hint: "Name the cohort", icon: Layers },
  { key: "learners", label: "Learners", hint: "Create accounts", icon: Users },
  { key: "assessments", label: "Assessments", hint: "Assign to the cohort", icon: ClipboardList },
  { key: "progress", label: "Progress", hint: "Track results", icon: Trophy },
];

const inputClass =
  "w-full rounded-xl border border-border bg-slate-50/50 dark:bg-slate-950 px-3 py-2 text-xs font-semibold text-foreground outline-none focus:ring-2 focus:ring-violet-200/50";
const textareaClass = `${inputClass} min-h-[110px] resize-y font-mono`;
const cardClass = "rounded-2xl border border-border bg-card p-4";
const primaryButton = "h-9 gap-1.5 bg-violet-600 text-xs font-bold text-white hover:bg-violet-700 rounded-xl";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseLearners(raw: string): { learners: LearnerInput[]; errors: string[] } {
  const learners: LearnerInput[] = [];
  const errors: string[] = [];
  raw.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return;
    const [employeeId = "", name = "", email = "", role = ""] = line.split(/[,\t;]/).map((part) => part.trim());
    if (/^(emp(loyee)?\s*id|id)$/i.test(employeeId) && /name/i.test(name)) return;
    if (!employeeId || !name || !EMAIL.test(email)) {
      errors.push(`Line ${index + 1}: use  Employee ID, Name, Email, Role`);
      return;
    }
    learners.push({ employeeId, name, email, role });
  });
  return { learners, errors };
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-secondary/30 px-3 py-2">
      <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-0.5 text-lg font-black text-foreground">{value}</div>
    </div>
  );
}

export function SlalomCohortWorkspace({
  fetcher,
  cohorts,
  assessments,
  onCohortsChanged,
  onDataChanged,
  onOpenAssessments,
  onOpenLeaderboard,
}: {
  fetcher: Fetcher;
  cohorts: any[];
  assessments: any[];
  onCohortsChanged: () => Promise<void>;
  onDataChanged: () => void;
  onOpenAssessments: () => void;
  onOpenLeaderboard: (cohortId: string) => void;
}) {
  const [selectedId, setSelectedId] = useState("");
  const [step, setStep] = useState<Step>("cohort");
  const [overview, setOverview] = useState<any>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [mode, setMode] = useState<"paste" | "upload" | "existing">("paste");
  const [pasteText, setPasteText] = useState("");
  const [existingText, setExistingText] = useState("");
  const [result, setResult] = useState<EnrollResult | null>(null);
  const [assignId, setAssignId] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const followStage = useRef(false);

  const call = useCallback(
    async (path: string, init?: RequestInit) => {
      const res = await fetcher(`${BASE}${path}`, { cache: "no-store", ...init });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data?.error || data?.message || `Request failed (${res.status}).`));
      return data;
    },
    [fetcher],
  );

  const loadOverview = useCallback(
    async (cohortId: string) => {
      const data = await call(`/cohorts/${encodeURIComponent(cohortId)}/overview`);
      setOverview(data);
      if (followStage.current) {
        followStage.current = false;
        setStep(data.stage as Step);
      }
    },
    [call],
  );

  useEffect(() => {
    if (!selectedId) {
      setOverview(null);
      return;
    }
    followStage.current = true;
    setResult(null);
    setError("");
    setNotice("");
    loadOverview(selectedId).catch((err) => setError(err instanceof Error ? err.message : "Could not load the cohort."));
  }, [selectedId, loadOverview]);

  const run = async (label: string, task: () => Promise<void>, success: string) => {
    setBusy(label);
    setError("");
    setNotice("");
    try {
      await task();
      if (success) setNotice(success);
      onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy("");
    }
  };

  const refresh = async () => {
    await Promise.all([loadOverview(selectedId), onCohortsChanged()]);
  };

  const createCohort = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setError("Cohort name is required.");
      return;
    }
    void run("create", async () => {
      const data = await call("/cohorts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name.trim(), description: form.description.trim() }),
      });
      await onCohortsChanged();
      setForm({ name: "", description: "" });
      setCreating(false);
      setSelectedId(String(data.id));
      setStep("learners");
    }, "Cohort created. Now add the learners who belong to it.");
  };

  const saveCohort = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setError("Cohort name is required.");
      return;
    }
    void run("save", async () => {
      await call(`/cohorts/${encodeURIComponent(selectedId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name.trim(), description: form.description.trim() }),
      });
      await refresh();
    }, "Cohort updated.");
  };

  const deleteCohort = (cohortId: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? Learner accounts and their test attempts will be kept.`)) return;
    void run(`delete-${cohortId}`, async () => {
      await call(`/cohorts/${encodeURIComponent(cohortId)}`, { method: "DELETE" });
      if (selectedId === cohortId) {
        setSelectedId("");
        setOverview(null);
        setCreating(false);
      }
      await onCohortsChanged();
    }, "Cohort deleted. Learner accounts and test attempts were kept.");
  };

  const enroll = (learners: LearnerInput[]) =>
    run("enroll", async () => {
      const data = await call(`/cohorts/${encodeURIComponent(selectedId)}/learners`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ learners }),
      });
      setResult(data);
      setPasteText("");
      await refresh();
    }, "");

  const submitPaste = (event: React.FormEvent) => {
    event.preventDefault();
    const { learners, errors } = parseLearners(pasteText);
    if (errors.length) {
      setError(errors.slice(0, 3).join(" · "));
      return;
    }
    if (!learners.length) {
      setError("Add at least one learner.");
      return;
    }
    void enroll(learners);
  };

  const submitFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    void run("enroll", async () => {
      const body = new FormData();
      body.append("file", file);
      const data = await call(`/cohorts/${encodeURIComponent(selectedId)}/learners/upload`, { method: "POST", body });
      setResult(data);
      await refresh();
    }, "");
  };

  const addExisting = (event: React.FormEvent) => {
    event.preventDefault();
    const members = existingText.split(/[\n,;]+/).map((part) => part.trim()).filter(Boolean);
    if (!members.length) {
      setError("Enter at least one existing Employee ID or email.");
      return;
    }
    void run("existing", async () => {
      await call(`/cohorts/${encodeURIComponent(selectedId)}/members/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ members }),
      });
      setExistingText("");
      await refresh();
    }, `Added ${members.length} existing employee${members.length === 1 ? "" : "s"} to the cohort.`);
  };

  const removeLearner = (employeeId: string) =>
    run(`remove-${employeeId}`, async () => {
      await call(`/cohorts/${encodeURIComponent(selectedId)}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId }),
      });
      await refresh();
    }, `${employeeId} removed from the cohort. Their account and results are kept.`);

  const assign = (event: React.FormEvent) => {
    event.preventDefault();
    if (!assignId) {
      setError("Select an assessment to assign.");
      return;
    }
    void run("assign", async () => {
      await call(`/assessments/${encodeURIComponent(assignId)}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cohortId: selectedId }),
      });
      setAssignId("");
      await refresh();
    }, "Assessment assigned to every learner in the cohort. Learners added later receive it automatically.");
  };

  const cohort = overview?.cohort;
  const learners: any[] = overview?.learners || [];
  const assigned: any[] = overview?.assessments || [];
  const summary = overview?.summary || {};
  const assignedIds = new Set(assigned.map((item) => item.assessmentId));
  const assignable = assessments.filter((row) => row.status === "published" && !assignedIds.has(row.id));
  const stage: Step = (overview?.stage as Step) || "cohort";
  const doneKeys = new Set<string>((overview?.steps || []).filter((item: any) => item.done).map((item: any) => item.key));

  useEffect(() => {
    if (cohort) setForm({ name: cohort.name || "", description: cohort.description || "" });
  }, [cohort]);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(15rem,19rem)_minmax(0,1fr)]">
      <aside className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">Cohorts ({cohorts.length})</h3>
          <Button type="button" size="sm" onClick={() => { setCreating(true); setSelectedId(""); setForm({ name: "", description: "" }); setError(""); setNotice(""); }} className={`${primaryButton} h-8`}>
            <Plus className="w-3.5 h-3.5" /> New cohort
          </Button>
        </div>
        {cohorts.length === 0 && !creating && (
          <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-xs text-muted-foreground">
            No cohorts yet. Create the first cohort to start the bootcamp flow.
          </p>
        )}
        <div className="space-y-2">
          {cohorts.map((row) => (
            <div
              key={row.id}
              className={`${cardClass} flex items-start gap-2 transition-colors ${selectedId === row.id ? "border-violet-500 ring-2 ring-violet-200/60" : "hover:border-violet-300"}`}
            >
              <button
                type="button"
                onClick={() => { setSelectedId(row.id); setCreating(false); }}
                className="min-w-0 flex-1 text-left"
              >
                <div className="truncate text-sm font-bold text-foreground">{row.name || "Untitled cohort"}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {row.memberCount ?? 0} learner{row.memberCount === 1 ? "" : "s"}
                  {row.description ? ` · ${row.description}` : ""}
                </div>
              </button>
              <button
                type="button"
                onClick={() => deleteCohort(row.id, row.name || "Untitled cohort")}
                disabled={busy !== ""}
                aria-label={`Delete ${row.name || "cohort"}`}
                className="shrink-0 rounded-lg p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      <section className="min-w-0 space-y-4">
        {(error || notice) && (
          <div className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold ${error ? "border-red-300 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300" : "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"}`}>
            {error ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
            <span>{error || notice}</span>
            <button type="button" onClick={() => { setError(""); setNotice(""); }} className="ml-auto opacity-70 hover:opacity-100" aria-label="Dismiss message">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {creating && (
          <form onSubmit={createCohort} className={`${cardClass} space-y-3`}>
            <h3 className="text-sm font-bold">Step 1 · Create the cohort</h3>
            <input required value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className={inputClass} placeholder="Cohort name, e.g. FY26 Wave 1" />
            <input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} className={inputClass} placeholder="Description (optional)" />
            <div className="flex gap-2">
              <Button type="submit" disabled={busy === "create"} className={primaryButton}>
                {busy === "create" && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Create and add learners
              </Button>
              <Button type="button" variant="outline" onClick={() => setCreating(false)} className="h-9 text-xs font-bold">Cancel</Button>
            </div>
          </form>
        )}

        {!creating && !selectedId && cohorts.length > 0 && (
          <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-xs text-muted-foreground">
            Select a cohort to continue where it left off.
          </p>
        )}

        {!creating && selectedId && !overview && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading cohort…</div>
        )}

        {!creating && selectedId && overview && (
          <>
            <div className="flex flex-wrap gap-2">
              {STEPS.map(({ key, label, hint, icon: Icon }, index) => {
                const done = doneKeys.has(key) && key !== "cohort" ? true : key === "cohort";
                const active = step === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setStep(key)}
                    className={`flex min-w-[8.5rem] flex-1 items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors ${active ? "border-violet-500 bg-violet-600 text-white" : "border-border bg-card hover:border-violet-300"}`}
                  >
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${active ? "bg-white/20" : done ? "bg-emerald-100 text-emerald-700" : "bg-secondary text-muted-foreground"}`}>
                      {done && !active ? <Check className="w-3.5 h-3.5" /> : index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1 text-xs font-bold"><Icon className="w-3.5 h-3.5" /> {label}</span>
                      <span className={`block truncate text-[10px] ${active ? "text-white/80" : "text-muted-foreground"}`}>{key === stage && !active ? "Next step" : hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {step === "cohort" && (
              <form onSubmit={saveCohort} className={`${cardClass} space-y-3`}>
                <h3 className="text-sm font-bold">Cohort details</h3>
                <input required value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className={inputClass} placeholder="Cohort name" />
                <input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} className={inputClass} placeholder="Description (optional)" />
                <Button type="submit" disabled={busy === "save"} className={primaryButton}>
                  {busy === "save" && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save details
                </Button>
              </form>
            )}

            {step === "learners" && (
              <div className="space-y-4">
                <div className={`${cardClass} space-y-3`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="flex items-center gap-1.5 text-sm font-bold"><UserPlus className="w-4 h-4 text-violet-600" /> Create learner accounts in {cohort?.name}</h3>
                    <div className="flex gap-1.5">
                      {([["paste", "Type or paste"], ["upload", "Upload file"], ["existing", "Existing accounts"]] as const).map(([key, label]) => (
                        <button key={key} type="button" onClick={() => setMode(key)} className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${mode === key ? "bg-violet-600 text-white" : "bg-secondary/60 text-muted-foreground hover:text-foreground"}`}>{label}</button>
                      ))}
                    </div>
                  </div>
                  {mode === "paste" && (
                    <form onSubmit={submitPaste} className="space-y-2">
                      <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} className={textareaClass} placeholder={"E12345, Asha Rao, asha@slalom.com, Analyst\nE12346, Ben Lee, ben@slalom.com, Engineer"} />
                      <p className="text-[11px] text-muted-foreground">One learner per line: Employee ID, Name, Email, Role. The first-login password is the Employee ID.</p>
                      <Button type="submit" disabled={busy === "enroll"} className={primaryButton}>
                        {busy === "enroll" && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Create accounts and add to cohort
                      </Button>
                    </form>
                  )}
                  {mode === "upload" && (
                    <div className="space-y-2">
                      <input ref={fileRef} type="file" accept=".csv,.xlsx,.xlsm" onChange={submitFile} disabled={busy === "enroll"} className="block w-full text-[11px] text-muted-foreground" />
                      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Upload className="w-3.5 h-3.5" /> Columns: Emp ID, Name, Email (required), Role (optional). Up to 500 rows.</p>
                    </div>
                  )}
                  {mode === "existing" && (
                    <form onSubmit={addExisting} className="space-y-2">
                      <textarea value={existingText} onChange={(e) => setExistingText(e.target.value)} className={textareaClass} placeholder={"E12345\nname@slalom.com"} />
                      <p className="text-[11px] text-muted-foreground">Only for people who already have an employee portal account.</p>
                      <Button type="submit" disabled={busy === "existing"} className={primaryButton}>
                        {busy === "existing" && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Add to cohort
                      </Button>
                    </form>
                  )}
                  {result && (
                    <div className="rounded-xl border border-border bg-secondary/30 p-3 text-xs">
                      <div className="font-bold text-foreground">
                        {result.enrolled.length} added ({result.created} new account{result.created === 1 ? "" : "s"}, {result.existing} existing)
                        {result.failed.length ? ` · ${result.failed.length} need attention` : ""}
                      </div>
                      {result.failed.slice(0, 8).map((item) => (
                        <div key={`${item.row}-${item.employeeId}`} className="mt-1 text-red-600">Row {item.row}{item.employeeId ? ` (${item.employeeId})` : ""}: {item.error}</div>
                      ))}
                      {result.enrolled.some((item) => item.assigned > 0) && (
                        <div className="mt-1 text-muted-foreground">Cohort assessments were assigned to the new learners automatically.</div>
                      )}
                    </div>
                  )}
                </div>

                <div className={`${cardClass} space-y-2`}>
                  <h3 className="text-sm font-bold">Learners ({learners.length})</h3>
                  {learners.length === 0 ? (
                    <p className="py-4 text-center text-xs text-muted-foreground">No learners yet. Add the first intake above.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                          <tr><th className="py-1.5 pr-3">Employee ID</th><th className="pr-3">Name</th><th className="pr-3">Email</th><th /></tr>
                        </thead>
                        <tbody>
                          {learners.map((row) => (
                            <tr key={row.employeeId} className="border-t border-border">
                              <td className="py-1.5 pr-3 font-bold">{row.employeeId}</td>
                              <td className="pr-3">{row.employeeName}</td>
                              <td className="pr-3 text-muted-foreground">{row.email}</td>
                              <td className="text-right">
                                <button type="button" onClick={() => void removeLearner(row.employeeId)} disabled={busy !== ""} className="text-red-600 hover:text-red-700" aria-label={`Remove ${row.employeeId}`}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {learners.length > 0 && (
                    <Button type="button" variant="outline" onClick={() => setStep("assessments")} className="h-8 text-xs font-bold">Continue to assessments</Button>
                  )}
                </div>
              </div>
            )}

            {step === "assessments" && (
              <div className="space-y-4">
                <form onSubmit={assign} className={`${cardClass} space-y-3`}>
                  <h3 className="text-sm font-bold">Assign an assessment to {cohort?.name}</h3>
                  {assignable.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {assessments.some((row) => row.status === "published")
                        ? "Every published assessment is already assigned to this cohort."
                        : "No published assessments yet."}{" "}
                      <button type="button" onClick={onOpenAssessments} className="font-bold text-violet-600 underline">Create or publish an assessment</button>
                    </p>
                  ) : (
                    <>
                      <select value={assignId} onChange={(e) => setAssignId(e.target.value)} className={inputClass}>
                        <option value="">Select a published assessment…</option>
                        {assignable.map((row) => <option key={row.id} value={row.id}>{row.name || row.title || "Untitled assessment"}</option>)}
                      </select>
                      <p className="text-[11px] text-muted-foreground">
                        {learners.length === 0 ? "Add learners first, or assign now and new learners will receive it as they join." : `Assigns to all ${learners.length} learner${learners.length === 1 ? "" : "s"}; learners added later receive it automatically.`}
                      </p>
                      <Button type="submit" disabled={busy === "assign"} className={primaryButton}>
                        {busy === "assign" && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Assign to cohort
                      </Button>
                    </>
                  )}
                </form>
                <div className={`${cardClass} space-y-2`}>
                  <h3 className="text-sm font-bold">Assigned assessments ({assigned.length})</h3>
                  {assigned.length === 0 ? (
                    <p className="py-4 text-center text-xs text-muted-foreground">Nothing assigned yet.</p>
                  ) : assigned.map((item) => (
                    <div key={item.assessmentId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-xs">
                      <span className="font-bold">{item.name}</span>
                      <span className="text-muted-foreground">{item.completed}/{item.assigned} completed · {item.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === "progress" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                  <Stat label="Learners" value={summary.learners ?? 0} />
                  <Stat label="Assigned" value={summary.assigned ?? 0} />
                  <Stat label="Started" value={summary.started ?? 0} />
                  <Stat label="Completed" value={summary.completed ?? 0} />
                  <Stat label="Avg score" value={summary.averageScore == null ? "—" : `${summary.averageScore}%`} />
                </div>
                <div className={`${cardClass} space-y-2`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-bold">Learner progress</h3>
                    <Button type="button" variant="outline" onClick={() => onOpenLeaderboard(selectedId)} className="h-8 gap-1.5 text-xs font-bold"><Trophy className="w-3.5 h-3.5" /> Open leaderboard</Button>
                  </div>
                  {learners.length === 0 ? (
                    <p className="py-4 text-center text-xs text-muted-foreground">No learners in this cohort yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                          <tr><th className="py-1.5 pr-3">Learner</th><th className="pr-3">Assigned</th><th className="pr-3">Started</th><th className="pr-3">Completed</th><th>Avg score</th></tr>
                        </thead>
                        <tbody>
                          {learners.map((row) => (
                            <tr key={row.employeeId} className="border-t border-border">
                              <td className="py-1.5 pr-3"><span className="font-bold">{row.employeeName || row.employeeId}</span><span className="ml-1.5 text-muted-foreground">{row.employeeId}</span></td>
                              <td className="pr-3">{row.assigned}</td>
                              <td className="pr-3">{row.started}</td>
                              <td className="pr-3">{row.completed}</td>
                              <td>{row.averageScore == null ? "—" : `${row.averageScore}%`}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
