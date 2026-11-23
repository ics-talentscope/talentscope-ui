"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Edit2,
  Loader2,
  RefreshCcw,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/** Fired after any bootcamp mutation so AdminDashboard can re-fetch employee portal data. */
export const BOOTCAMP_DATA_CHANGED_EVENT = "bootcamp-data-changed";

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

const BASE = "/api/admin/slalom/bootcamp";

const inputClass =
  "w-full rounded-xl border border-border bg-slate-50/50 dark:bg-slate-950 px-3 py-2 text-xs font-semibold text-foreground outline-none focus:ring-2 focus:ring-violet-200/50";
const textareaClass = `${inputClass} min-h-[76px] resize-y`;
const labelClass = "block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1";
const cardClass = "rounded-2xl border border-border bg-card p-4";
const primaryButton =
  "h-9 gap-1.5 bg-violet-600 text-xs font-bold text-white hover:bg-violet-700 rounded-xl";

/* ---------------------------------- helpers --------------------------------- */

function asArray(data: any, ...keys: string[]): any[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    for (const key of keys) {
      const value = (data as any)[key];
      if (Array.isArray(value)) return value;
    }
  }
  return [];
}

function pick(obj: any, ...keys: string[]): any {
  if (!obj || typeof obj !== "object") return undefined;
  for (const key of keys) {
    const value = (obj as any)[key];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

function text(value: any): string {
  return value === undefined || value === null ? "" : String(value);
}

function number(value: any, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(value: any): boolean {
  return value === true || value === 1 || value === "true" || value === "1";
}

function toLocalInput(iso: any): string {
  const raw = text(iso);
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIso(local: string): string | null {
  if (!local) return null;
  const date = new Date(local);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function formatSeconds(seconds: any): string {
  const total = Math.max(0, Math.round(number(seconds)));
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, "0")}`;
}

function formatTime(value: any): string {
  if (typeof value === "string" && value.includes(":")) return value;
  if (value === undefined || value === null || value === "") return "—";
  return formatSeconds(value);
}

function formatCell(value: any): string {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map(formatCell).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function parseMembers(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function durationToMinutes(row: any): string {
  const seconds = pick(row, "durationSeconds", "duration_seconds", "timeLimitSeconds", "time_limit_seconds");
  if (seconds !== undefined) return String(Math.round(number(seconds) / 60));
  const minutes = pick(row, "durationMinutes", "duration_minutes", "duration", "timeLimitMinutes", "time_limit_minutes");
  return minutes === undefined ? "" : String(number(minutes));
}

/* ---------------------------------- small UI -------------------------------- */

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[10px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

function StatusPill({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const color =
    normalized === "published"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
      : normalized === "closed"
        ? "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
        : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${color}`}>
      {status || "draft"}
    </span>
  );
}

/* ----------------------------------- forms ---------------------------------- */

type AssessmentForm = {
  id: string;
  name: string;
  description: string;
  bankKey: string;
  questionCount: string;
  durationMinutes: string;
  topicsText: string;
  easy: string;
  medium: string;
  hard: string;
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  status: "draft" | "published" | "closed";
  startsAt: string;
  endsAt: string;
  attemptLimit: string;
};

const EMPTY_ASSESSMENT: AssessmentForm = {
  id: "",
  name: "",
  description: "",
  bankKey: "",
  questionCount: "25",
  durationMinutes: "30",
  topicsText: "",
  easy: "",
  medium: "",
  hard: "",
  randomizeQuestions: true,
  randomizeOptions: true,
  status: "draft",
  startsAt: "",
  endsAt: "",
  attemptLimit: "",
};

function difficultyTotal(form: AssessmentForm): number {
  return number(form.easy) + number(form.medium) + number(form.hard);
}

type CohortForm = { id: string; name: string; description: string };
const EMPTY_COHORT: CohortForm = { id: "", name: "", description: "" };

type ContentForm = {
  id: string;
  type: string;
  key: string;
  title: string;
  body: string;
  source: string;
  metadataText: string;
};
const EMPTY_CONTENT: ContentForm = { id: "", type: "article", key: "", title: "", body: "", source: "", metadataText: "{}" };

function assessmentFromRow(row: any): AssessmentForm {
  const mix = pick(row, "difficultyMix", "difficulty_mix") || {};
  const topics = pick(row, "topics", "topicList", "topic_list");
  const statusValue = text(pick(row, "status")).toLowerCase();
  return {
    id: text(pick(row, "id", "_id", "assessmentId", "assessment_id")),
    name: text(pick(row, "name", "title", "assessmentName", "assessment_name")),
    description: text(pick(row, "description", "desc")),
    bankKey: text(pick(row, "bankKey", "bank_key", "product", "bank", "questionBank")),
    questionCount: text(pick(row, "questionCount", "question_count", "numQuestions", "num_questions") ?? ""),
    durationMinutes: durationToMinutes(row),
    topicsText: Array.isArray(topics) ? topics.map(text).join(", ") : text(topics),
    easy: text(pick(mix, "easy", "basic", "low") ?? ""),
    medium: text(pick(mix, "medium", "intermediate", "mid") ?? ""),
    hard: text(pick(mix, "hard", "advanced", "high") ?? ""),
    randomizeQuestions: bool(pick(row, "randomizeQuestions", "randomize_questions", "shuffleQuestions", "shuffle_questions")),
    randomizeOptions: bool(pick(row, "randomizeOptions", "randomize_options", "shuffleOptions", "shuffle_options")),
    status: (["draft", "published", "closed"].includes(statusValue) ? statusValue : "draft") as AssessmentForm["status"],
    startsAt: toLocalInput(pick(row, "startsAt", "starts_at", "startDate", "start_date", "startWindow", "start_window")),
    endsAt: toLocalInput(pick(row, "endsAt", "ends_at", "endDate", "end_date", "endWindow", "end_window")),
    attemptLimit: text(pick(row, "attemptLimit", "attempt_limit", "maxAttempts", "max_attempts") ?? ""),
  };
}

function cohortFromRow(row: any): CohortForm {
  return {
    id: text(pick(row, "id", "_id", "cohortId", "cohort_id")),
    name: text(pick(row, "name", "title", "cohortName", "cohort_name")),
    description: text(pick(row, "description", "desc")),
  };
}

function contentFromRow(row: any): ContentForm {
  const metadata = pick(row, "metadata", "meta", "sourceMetadata", "source_metadata");
  return {
    id: text(pick(row, "id", "_id", "contentId", "content_id")),
    type: text(pick(row, "type", "contentType", "content_type") || "article"),
    key: text(pick(row, "key", "slug", "contentKey", "content_key")),
    title: text(pick(row, "title", "name")),
    body: text(pick(row, "body", "content", "text")),
    source: text(pick(row, "source", "sourceKey", "source_key", "sourceType", "source_type")),
    metadataText: metadata && typeof metadata === "object" ? JSON.stringify(metadata, null, 2) : "{}",
  };
}

function assessmentPayload(form: AssessmentForm) {
  const topics = form.topicsText.split(/[,\n]/).map((part) => part.trim()).filter(Boolean);
  const durationSeconds = Math.max(0, Math.round(number(form.durationMinutes) * 60));
  const startsAt = toIso(form.startsAt);
  const endsAt = toIso(form.endsAt);
  const attemptLimit = form.attemptLimit.trim() === "" ? null : number(form.attemptLimit);
  const difficultyMix = { easy: number(form.easy), medium: number(form.medium), hard: number(form.hard) };
  return {
    id: form.id || undefined,
    name: form.name.trim(),
    title: form.name.trim(),
    description: form.description.trim(),
    bankKey: form.bankKey.trim(),
    bank_key: form.bankKey.trim(),
    product: form.bankKey.trim(),
    questionCount: number(form.questionCount),
    question_count: number(form.questionCount),
    durationSeconds,
    duration_seconds: durationSeconds,
    durationMinutes: number(form.durationMinutes),
    duration_minutes: number(form.durationMinutes),
    topics,
    difficultyMix,
    difficulty_mix: difficultyMix,
    randomizeQuestions: form.randomizeQuestions,
    randomize_questions: form.randomizeQuestions,
    randomizeOptions: form.randomizeOptions,
    randomize_options: form.randomizeOptions,
    status: form.status,
    startsAt,
    starts_at: startsAt,
    endsAt,
    ends_at: endsAt,
    attemptLimit,
    attempt_limit: attemptLimit,
  };
}

type Section = "assessments" | "cohorts" | "content" | "leaderboard";

/* --------------------------------- component -------------------------------- */

export function SlalomBootcampManager({
  fetcher,
  onOpenEmployeePortalManager,
}: {
  fetcher: Fetcher;
  onOpenEmployeePortalManager?: () => void;
}) {
  const [section, setSection] = useState<Section>("assessments");
  const [assessments, setAssessments] = useState<any[]>([]);
  const [cohorts, setCohorts] = useState<any[]>([]);
  const [content, setContent] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [assessmentForm, setAssessmentForm] = useState<AssessmentForm>(EMPTY_ASSESSMENT);
  const [editingAssessment, setEditingAssessment] = useState(false);

  const [cohortForm, setCohortForm] = useState<CohortForm>(EMPTY_COHORT);
  const [editingCohort, setEditingCohort] = useState(false);
  const [bulkCohortId, setBulkCohortId] = useState("");
  const [bulkMembersText, setBulkMembersText] = useState("");
  const [assignAssessmentId, setAssignAssessmentId] = useState("");
  const [assignCohortId, setAssignCohortId] = useState("");
  const [assignEmployeeText, setAssignEmployeeText] = useState("");

  const [contentForm, setContentForm] = useState<ContentForm>(EMPTY_CONTENT);
  const [editingContent, setEditingContent] = useState(false);

  const [boardAssessmentId, setBoardAssessmentId] = useState("");
  const [boardCohortId, setBoardCohortId] = useState("");
  const boardFiltersRef = useRef({ assessmentId: "", cohortId: "" });
  const assessmentMixTotal = difficultyTotal(assessmentForm);
  const assessmentMixInvalid = assessmentMixTotal > number(assessmentForm.questionCount);

  const showError = useCallback((err: unknown) => {
    setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
  }, []);

  const notifyPortalChange = useCallback(() => {
    if (typeof window !== "undefined") window.dispatchEvent(new Event(BOOTCAMP_DATA_CHANGED_EVENT));
  }, []);

  const readJson = useCallback(async (res: Response) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(text(pick(data, "error", "message", "detail")) || `Request failed (${res.status}).`);
    }
    return data;
  }, []);

  const loadAssessments = useCallback(async () => {
    const data = await readJson(await fetcher(`${BASE}/assessments`, { cache: "no-store" }));
    setAssessments(asArray(data, "assessments", "items", "results", "data"));
  }, [fetcher, readJson]);

  const loadCohorts = useCallback(async () => {
    const data = await readJson(await fetcher(`${BASE}/cohorts`, { cache: "no-store" }));
    setCohorts(asArray(data, "cohorts", "items", "results", "data"));
  }, [fetcher, readJson]);

  const loadContent = useCallback(async () => {
    const data = await readJson(await fetcher(`${BASE}/content`, { cache: "no-store" }));
    setContent(asArray(data, "content", "items", "results", "data", "sources"));
  }, [fetcher, readJson]);

  const fetchLeaderboard = useCallback(
    async (assessmentId: string, cohortId: string) => {
      const params = new URLSearchParams();
      if (assessmentId) params.set("assessment_id", assessmentId);
      if (cohortId) params.set("cohort_id", cohortId);
      const query = params.toString();
      const data = await readJson(await fetcher(`${BASE}/leaderboard${query ? `?${query}` : ""}`, { cache: "no-store" }));
      setLeaderboard(asArray(data, "leaderboard", "rows", "results", "items", "entries", "data"));
    },
    [fetcher, readJson],
  );

  const loadAll = useCallback(async () => {
    setError("");
    try {
      await Promise.all([
        loadAssessments(),
        loadCohorts(),
        loadContent(),
        fetchLeaderboard(boardFiltersRef.current.assessmentId, boardFiltersRef.current.cohortId),
      ]);
    } catch (err) {
      showError(err);
    } finally {
      setInitialLoading(false);
    }
  }, [loadAssessments, loadCohorts, loadContent, fetchLeaderboard, showError]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const run = useCallback(
    async (label: string, task: () => Promise<void>, successMessage: string) => {
      setBusy(label);
      setError("");
      setNotice("");
      try {
        await task();
        setNotice(successMessage);
        notifyPortalChange();
      } catch (err) {
        showError(err);
      } finally {
        setBusy("");
      }
    },
    [notifyPortalChange, showError],
  );

  const changeBoardAssessment = (value: string) => {
    setBoardAssessmentId(value);
    boardFiltersRef.current = { ...boardFiltersRef.current, assessmentId: value };
    void fetchLeaderboard(value, boardCohortId).catch(showError);
  };

  const changeBoardCohort = (value: string) => {
    setBoardCohortId(value);
    boardFiltersRef.current = { ...boardFiltersRef.current, cohortId: value };
    void fetchLeaderboard(boardAssessmentId, value).catch(showError);
  };

  const refreshAll = async () => {
    setNotice("");
    await loadAll();
    notifyPortalChange();
    setNotice("Bootcamp and employee portal data refreshed.");
  };

  /* --------------------------------- assessments ------------------------------ */

  const resetAssessmentForm = () => {
    setAssessmentForm(EMPTY_ASSESSMENT);
    setEditingAssessment(false);
  };

  const saveAssessment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!assessmentForm.name.trim()) {
      setError("Assessment name is required.");
      return;
    }
    const questionCount = number(assessmentForm.questionCount);
    const mixTotal = difficultyTotal(assessmentForm);
    if (!Number.isFinite(questionCount) || questionCount < 1) {
      setError("Question count must be at least 1.");
      return;
    }
    if (mixTotal > questionCount) {
      setError(`Difficulty mix total (${mixTotal}) cannot exceed the question count (${questionCount}).`);
      return;
    }
    const id = assessmentForm.id;
    await run("assessment", async () => {
      const res = await fetcher(id ? `${BASE}/assessments/${encodeURIComponent(id)}` : `${BASE}/assessments`, {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(assessmentPayload(assessmentForm)),
      });
      await readJson(res);
      await loadAssessments();
      resetAssessmentForm();
    }, id ? "Assessment updated." : "Assessment created.");
  };

  const setAssessmentStatus = async (row: any, status: "draft" | "published" | "closed") => {
    const id = text(pick(row, "id", "_id", "assessmentId", "assessment_id"));
    if (!id) return;
    await run(`status-${id}`, async () => {
      const res = await fetcher(`${BASE}/assessments/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          action: status === "published" ? "publish" : status === "closed" ? "close" : "draft",
        }),
      });
      await readJson(res);
      await loadAssessments();
      if (assessmentForm.id === id) setAssessmentForm((prev) => ({ ...prev, status }));
    }, `Assessment marked ${status}.`);
  };

  /* ----------------------------------- cohorts -------------------------------- */

  const resetCohortForm = () => {
    setCohortForm(EMPTY_COHORT);
    setEditingCohort(false);
  };

  const saveCohort = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!cohortForm.name.trim()) {
      setError("Cohort name is required.");
      return;
    }
    const id = cohortForm.id;
    await run("cohort", async () => {
      const res = await fetcher(id ? `${BASE}/cohorts/${encodeURIComponent(id)}` : `${BASE}/cohorts`, {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cohortForm.name.trim(), description: cohortForm.description.trim() }),
      });
      await readJson(res);
      await loadCohorts();
      resetCohortForm();
    }, id ? "Cohort updated." : "Cohort created.");
  };

  const bulkMembers = async (event: React.FormEvent) => {
    event.preventDefault();
    const cohortId = bulkCohortId || cohortForm.id;
    const members = parseMembers(bulkMembersText);
    if (!cohortId) {
      setError("Select a cohort first.");
      return;
    }
    if (members.length === 0) {
      setError("Add at least one employee ID or email.");
      return;
    }
    await run("members", async () => {
      const res = await fetcher(`${BASE}/cohorts/${encodeURIComponent(cohortId)}/members/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ members, employeeIds: members, employee_ids: members }),
      });
      await readJson(res);
      await loadCohorts();
      setBulkMembersText("");
    }, `Added ${members.length} member${members.length === 1 ? "" : "s"} to the cohort.`);
  };

  const onRosterFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      setBulkMembersText((prev) => `${prev}${prev.trim() ? "\n" : ""}${content}`);
    } catch {
      setError("Could not read that roster file. Paste the IDs or emails instead.");
    } finally {
      event.target.value = "";
    }
  };

  const assignAssessment = async (event: React.FormEvent) => {
    event.preventDefault();
    const employees = parseMembers(assignEmployeeText);
    if (!assignAssessmentId) {
      setError("Select an assessment to assign.");
      return;
    }
    if (!assignCohortId && employees.length === 0) {
      setError("Choose a cohort or enter at least one employee ID.");
      return;
    }
    await run("assign", async () => {
      const res = await fetcher(`${BASE}/assessments/${encodeURIComponent(assignAssessmentId)}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cohortId: assignCohortId || null,
          cohort_id: assignCohortId || null,
          employeeIds: employees,
          employee_ids: employees,
        }),
      });
      await readJson(res);
      await Promise.all([loadAssessments(), loadCohorts()]);
    }, "Assessment assigned.");
  };

  /* ---------------------------------- content --------------------------------- */

  const resetContentForm = () => {
    setContentForm(EMPTY_CONTENT);
    setEditingContent(false);
  };

  const saveContent = async (event: React.FormEvent) => {
    event.preventDefault();
    let metadata: any = {};
    if (contentForm.metadataText.trim()) {
      try {
        metadata = JSON.parse(contentForm.metadataText);
      } catch {
        setError("Source metadata must be valid JSON.");
        return;
      }
    }
    if (!contentForm.title.trim() && !contentForm.key.trim()) {
      setError("A title or key is required.");
      return;
    }
    const id = contentForm.id;
    await run("content", async () => {
      const res = await fetcher(`${BASE}/content${id ? `?id=${encodeURIComponent(id)}` : ""}`, {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: id || undefined,
          type: contentForm.type.trim(),
          key: contentForm.key.trim(),
          title: contentForm.title.trim(),
          body: contentForm.body,
          source: contentForm.source.trim(),
          metadata,
          sourceType: text(metadata.sourceType ?? metadata.source_type ?? contentForm.source),
          sourceUrl: text(metadata.sourceUrl ?? metadata.source_url),
          sourceKey: text(metadata.sourceKey ?? metadata.source_key),
        }),
      });
      await readJson(res);
      await loadContent();
      resetContentForm();
    }, id ? "Content updated." : "Content created.");
  };

  const deleteContent = async (row: any) => {
    const id = text(pick(row, "id", "_id", "contentId", "content_id"));
    if (!id || !window.confirm("Delete this learning content source?")) return;
    await run("delete-content", async () => {
      const res = await fetcher(`${BASE}/content?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      await readJson(res);
      await loadContent();
      if (contentForm.id === id) resetContentForm();
    }, "Content deleted.");
  };

  /* ---------------------------------- render ---------------------------------- */

  const sections: Array<{ key: Section; label: string; icon: React.ComponentType<{ className?: string }>; count: number }> = [
    { key: "assessments", label: "Assessments", icon: ClipboardList, count: assessments.length },
    { key: "cohorts", label: "Cohorts", icon: Users, count: cohorts.length },
    { key: "content", label: "Learning Content", icon: BookOpen, count: content.length },
    { key: "leaderboard", label: "Leaderboard", icon: RefreshCcw, count: leaderboard.length },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-black text-foreground flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-violet-600" /> Bootcamp Management
          </h2>
          <p className="mt-1 text-xs text-muted-foreground max-w-2xl">
            Create assessments, organise cohorts, manage learning sources and review proctored results. Published changes are picked up by the employee portal on its next refresh.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onOpenEmployeePortalManager && (
            <Button type="button" variant="outline" size="sm" onClick={onOpenEmployeePortalManager} className="h-9 gap-1.5 text-xs font-bold">
              <UserPlus className="w-3.5 h-3.5" /> Question banks &amp; employees
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => void refreshAll()} disabled={initialLoading || busy !== ""} className="h-9 gap-1.5 text-xs font-bold">
            {initialLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />} Refresh
          </Button>
        </div>
      </div>

      {(error || notice) && (
        <div
          className={`rounded-xl border px-3 py-2.5 text-xs font-semibold ${
            error
              ? "border-red-300 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300"
              : "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {error ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
            <span>{error || notice}</span>
            <button
              type="button"
              onClick={() => { setError(""); setNotice(""); }}
              className="ml-auto shrink-0 opacity-70 hover:opacity-100"
              aria-label="Dismiss message"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {sections.map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            type="button"
            onClick={() => setSection(key)}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-colors ${
              section === key
                ? "bg-violet-600 text-white"
                : "bg-secondary/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${section === key ? "bg-white/20" : "bg-background/70"}`}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {initialLoading ? (
        <div className="flex flex-col items-center justify-center gap-2 py-20 text-xs font-semibold text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin text-violet-600" /> Loading bootcamp data…
        </div>
      ) : (
        <>
          {/* ------------------------------ Assessments ----------------------------- */}
          {section === "assessments" && (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]">
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-foreground">Assessments ({assessments.length})</h3>
                {assessments.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-xs text-muted-foreground">
                    No assessments yet. Create one using the form.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {assessments.map((row, index) => {
                      const item = assessmentFromRow(row);
                      return (
                        <div key={item.id || `assessment-${index}`} className={cardClass}>
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-bold text-foreground truncate">{item.name || "Untitled assessment"}</span>
                                <StatusPill status={item.status} />
                              </div>
                              <div className="mt-1 text-[11px] text-muted-foreground font-semibold">
                                {item.bankKey ? `Bank: ${item.bankKey} · ` : ""}
                                {item.questionCount || "—"} questions · {formatSeconds(number(item.durationMinutes) * 60)} ·{" "}
                                {item.topicsText || "No topics"}
                              </div>
                              {item.description && <p className="mt-1 text-[11px] text-muted-foreground">{item.description}</p>}
                              <div className="mt-1 text-[10px] text-muted-foreground">
                                Attempts: {item.attemptLimit || "unlimited"} · Window: {item.startsAt || "anytime"} → {item.endsAt || "anytime"} · Mix {item.easy || 0}/{item.medium || 0}/{item.hard || 0}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              <Button type="button" size="sm" variant="outline" onClick={() => { setAssessmentForm(item); setEditingAssessment(true); }} className="h-7 gap-1 text-[10px] font-bold">
                                <Edit2 className="w-3 h-3" /> Edit
                              </Button>
                              {item.status !== "published" && (
                                <Button type="button" size="sm" variant="outline" onClick={() => void setAssessmentStatus(row, "published")} disabled={busy !== ""} className="h-7 text-[10px] font-bold">
                                  Publish
                                </Button>
                              )}
                              {item.status !== "closed" && (
                                <Button type="button" size="sm" variant="outline" onClick={() => void setAssessmentStatus(row, "closed")} disabled={busy !== ""} className="h-7 text-[10px] font-bold">
                                  Close
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <form onSubmit={saveAssessment} className={`${cardClass} h-fit space-y-3`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold">{editingAssessment ? "Edit assessment" : "New assessment"}</h3>
                  {editingAssessment && (
                    <button type="button" onClick={resetAssessmentForm} className="text-[10px] font-bold text-muted-foreground hover:text-foreground">
                      Cancel
                    </button>
                  )}
                </div>
                <Field label="Name">
                  <input required value={assessmentForm.name} onChange={(e) => setAssessmentForm((p) => ({ ...p, name: e.target.value }))} className={inputClass} placeholder="e.g. Slalom Core Bootcamp Assessment" />
                </Field>
                <Field label="Description">
                  <textarea value={assessmentForm.description} onChange={(e) => setAssessmentForm((p) => ({ ...p, description: e.target.value }))} className={textareaClass} placeholder="What does this assessment cover?" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Bank key / product">
                    <input value={assessmentForm.bankKey} onChange={(e) => setAssessmentForm((p) => ({ ...p, bankKey: e.target.value }))} className={inputClass} placeholder="e.g. slalom-core" />
                  </Field>
                  <Field label="Question count">
                    <input type="number" min="1" value={assessmentForm.questionCount} onChange={(e) => setAssessmentForm((p) => ({ ...p, questionCount: e.target.value }))} className={inputClass} />
                  </Field>
                  <Field label="Duration (minutes)">
                    <input type="number" min="1" value={assessmentForm.durationMinutes} onChange={(e) => setAssessmentForm((p) => ({ ...p, durationMinutes: e.target.value }))} className={inputClass} />
                  </Field>
                  <Field label="Attempt limit" hint="Blank = unlimited">
                    <input type="number" min="1" value={assessmentForm.attemptLimit} onChange={(e) => setAssessmentForm((p) => ({ ...p, attemptLimit: e.target.value }))} className={inputClass} />
                  </Field>
                </div>
                <Field label="Topics" hint="Comma or newline separated">
                  <textarea value={assessmentForm.topicsText} onChange={(e) => setAssessmentForm((p) => ({ ...p, topicsText: e.target.value }))} className={textareaClass} placeholder="Cloud, Data, Security" />
                </Field>
                <div>
                  <span className={`${labelClass} ${assessmentMixInvalid ? "text-red-600 dark:text-red-400" : ""}`}>
                    Difficulty mix (easy / medium / hard) — total {assessmentMixTotal}/{assessmentForm.questionCount || 0}
                  </span>
                  <div className="grid grid-cols-3 gap-3">
                    <input type="number" min="0" value={assessmentForm.easy} onChange={(e) => setAssessmentForm((p) => ({ ...p, easy: e.target.value }))} className={inputClass} placeholder="Easy" />
                    <input type="number" min="0" value={assessmentForm.medium} onChange={(e) => setAssessmentForm((p) => ({ ...p, medium: e.target.value }))} className={inputClass} placeholder="Medium" />
                    <input type="number" min="0" value={assessmentForm.hard} onChange={(e) => setAssessmentForm((p) => ({ ...p, hard: e.target.value }))} className={inputClass} placeholder="Hard" />
                  </div>
                  {assessmentMixInvalid && (
                    <span className="mt-1 block text-[10px] font-bold text-red-600 dark:text-red-400">
                      Reduce the difficulty mix so it does not exceed the question count.
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Starts at">
                    <input type="datetime-local" value={assessmentForm.startsAt} onChange={(e) => setAssessmentForm((p) => ({ ...p, startsAt: e.target.value }))} className={inputClass} />
                  </Field>
                  <Field label="Ends at">
                    <input type="datetime-local" value={assessmentForm.endsAt} onChange={(e) => setAssessmentForm((p) => ({ ...p, endsAt: e.target.value }))} className={inputClass} />
                  </Field>
                </div>
                <Field label="Status">
                  <select value={assessmentForm.status} onChange={(e) => setAssessmentForm((p) => ({ ...p, status: e.target.value as AssessmentForm["status"] }))} className={inputClass}>
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="closed">Closed</option>
                  </select>
                </Field>
                <div className="space-y-2 pt-1">
                  <label className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer">
                    <input type="checkbox" checked={assessmentForm.randomizeQuestions} onChange={(e) => setAssessmentForm((p) => ({ ...p, randomizeQuestions: e.target.checked }))} className="h-4 w-4 accent-violet-600" />
                    Randomize question order
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer">
                    <input type="checkbox" checked={assessmentForm.randomizeOptions} onChange={(e) => setAssessmentForm((p) => ({ ...p, randomizeOptions: e.target.checked }))} className="h-4 w-4 accent-violet-600" />
                    Randomize answer options
                  </label>
                </div>
                <Button type="submit" disabled={busy === "assessment"} className={`${primaryButton} w-full`}>
                  {busy === "assessment" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editingAssessment ? "Save changes" : "Create assessment"}
                </Button>
              </form>
            </div>
          )}

          {/* -------------------------------- Cohorts ------------------------------- */}
          {section === "cohorts" && (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]">
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-foreground">Cohorts ({cohorts.length})</h3>
                {cohorts.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-xs text-muted-foreground">
                    No cohorts yet. Create one using the form.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {cohorts.map((row, index) => {
                      const item = cohortFromRow(row);
                      const members = pick(row, "memberCount", "member_count", "members", "employeeIds", "employee_ids");
                      const memberCount = Array.isArray(members) ? members.length : members === undefined ? "—" : text(members);
                      return (
                        <div key={item.id || `cohort-${index}`} className={cardClass}>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-foreground truncate">{item.name || "Untitled cohort"}</div>
                              <div className="mt-1 text-[11px] text-muted-foreground">
                                {memberCount} member{Number(memberCount) === 1 ? "" : "s"}
                                {item.description ? ` · ${item.description}` : ""}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              <Button type="button" size="sm" variant="outline" onClick={() => { setBulkCohortId(item.id); setAssignCohortId(item.id); }} className="h-7 text-[10px] font-bold">
                                Select
                              </Button>
                              <Button type="button" size="sm" variant="outline" onClick={() => { setCohortForm(item); setEditingCohort(true); }} className="h-7 gap-1 text-[10px] font-bold">
                                <Edit2 className="w-3 h-3" /> Edit
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <form onSubmit={saveCohort} className={`${cardClass} space-y-3`}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold">{editingCohort ? "Edit cohort" : "New cohort"}</h3>
                    {editingCohort && (
                      <button type="button" onClick={resetCohortForm} className="text-[10px] font-bold text-muted-foreground hover:text-foreground">Cancel</button>
                    )}
                  </div>
                  <Field label="Cohort name">
                    <input required value={cohortForm.name} onChange={(e) => setCohortForm((p) => ({ ...p, name: e.target.value }))} className={inputClass} placeholder="e.g. FY26 Wave 1" />
                  </Field>
                  <Field label="Description">
                    <input value={cohortForm.description} onChange={(e) => setCohortForm((p) => ({ ...p, description: e.target.value }))} className={inputClass} placeholder="Optional" />
                  </Field>
                  <Button type="submit" disabled={busy === "cohort"} className={`${primaryButton} w-full`}>
                    {busy === "cohort" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {editingCohort ? "Save changes" : "Create cohort"}
                  </Button>
                </form>

                <form onSubmit={bulkMembers} className={`${cardClass} space-y-3`}>
                  <h3 className="text-sm font-bold flex items-center gap-1.5">
                    <Upload className="w-4 h-4 text-violet-600" /> Bulk roster
                  </h3>
                  <Field label="Cohort">
                    <select value={bulkCohortId} onChange={(e) => setBulkCohortId(e.target.value)} className={inputClass}>
                      <option value="">Select a cohort…</option>
                      {cohorts.map((row, index) => {
                        const item = cohortFromRow(row);
                        return <option key={item.id || `bulk-${index}`} value={item.id}>{item.name || "Untitled cohort"}</option>;
                      })}
                    </select>
                  </Field>
                  <Field label="Upload a roster (optional)" hint="Text/CSV of IDs or emails; appended below">
                    <input type="file" accept=".txt,.csv" onChange={(e) => void onRosterFile(e)} className="block w-full text-[11px] text-muted-foreground" />
                  </Field>
                  <Field label="Or paste employee IDs / emails" hint="One per line, or comma separated">
                    <textarea value={bulkMembersText} onChange={(e) => setBulkMembersText(e.target.value)} className={textareaClass} placeholder={"E12345\nname@slalom.com"} />
                  </Field>
                  <Button type="submit" disabled={busy === "members"} className={`${primaryButton} w-full`}>
                    {busy === "members" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Add members
                  </Button>
                </form>

                <form onSubmit={assignAssessment} className={`${cardClass} space-y-3`}>
                  <h3 className="text-sm font-bold flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-violet-600" /> Assign assessment
                  </h3>
                  <Field label="Assessment">
                    <select value={assignAssessmentId} onChange={(e) => setAssignAssessmentId(e.target.value)} className={inputClass}>
                      <option value="">Select an assessment…</option>
                      {assessments.map((row, index) => {
                        const item = assessmentFromRow(row);
                        return <option key={item.id || `assign-a-${index}`} value={item.id}>{item.name || "Untitled assessment"}</option>;
                      })}
                    </select>
                  </Field>
                  <Field label="Cohort">
                    <select value={assignCohortId} onChange={(e) => setAssignCohortId(e.target.value)} className={inputClass}>
                      <option value="">Entire cohort not selected</option>
                      {cohorts.map((row, index) => {
                        const item = cohortFromRow(row);
                        return <option key={item.id || `assign-c-${index}`} value={item.id}>{item.name || "Untitled cohort"}</option>;
                      })}
                    </select>
                  </Field>
                  <Field label="Or specific employees" hint="Optional; IDs or emails, one per line">
                    <textarea value={assignEmployeeText} onChange={(e) => setAssignEmployeeText(e.target.value)} className={textareaClass} placeholder="E12345, name@slalom.com" />
                  </Field>
                  <Button type="submit" disabled={busy === "assign"} className={`${primaryButton} w-full`}>
                    {busy === "assign" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Assign
                  </Button>
                </form>
              </div>
            </div>
          )}

          {/* ------------------------------- Content -------------------------------- */}
          {section === "content" && (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]">
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-foreground">Learning sources ({content.length})</h3>
                {content.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-xs text-muted-foreground">
                    No learning content yet. Add a source using the form.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {content.map((row, index) => {
                      const item = contentFromRow(row);
                      return (
                        <div key={item.id || `content-${index}`} className={cardClass}>
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-bold text-foreground truncate">{item.title || item.key || "Untitled source"}</span>
                                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-black uppercase text-muted-foreground">{item.type || "content"}</span>
                              </div>
                              <div className="mt-1 text-[11px] text-muted-foreground font-semibold">
                                {item.key ? `Key: ${item.key}` : "No key"}
                                {item.source ? ` · Source: ${item.source}` : ""}
                              </div>
                              {item.body && <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{item.body}</p>}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              <Button type="button" size="sm" variant="outline" onClick={() => { setContentForm(item); setEditingContent(true); }} className="h-7 gap-1 text-[10px] font-bold">
                                <Edit2 className="w-3 h-3" /> Edit
                              </Button>
                              <Button type="button" size="sm" variant="outline" onClick={() => void deleteContent(row)} disabled={busy === "delete-content"} className="h-7 gap-1 border-red-200 text-[10px] font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">
                                <Trash2 className="w-3 h-3" /> Delete
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <form onSubmit={saveContent} className={`${cardClass} h-fit space-y-3`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold">{editingContent ? "Edit content" : "New content"}</h3>
                  {editingContent && (
                    <button type="button" onClick={resetContentForm} className="text-[10px] font-bold text-muted-foreground hover:text-foreground">Cancel</button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Type" hint="article, video, link, guide…">
                    <input value={contentForm.type} onChange={(e) => setContentForm((p) => ({ ...p, type: e.target.value }))} className={inputClass} placeholder="article" />
                  </Field>
                  <Field label="Key / slug">
                    <input value={contentForm.key} onChange={(e) => setContentForm((p) => ({ ...p, key: e.target.value }))} className={inputClass} placeholder="cloud-basics" />
                  </Field>
                </div>
                <Field label="Title">
                  <input value={contentForm.title} onChange={(e) => setContentForm((p) => ({ ...p, title: e.target.value }))} className={inputClass} placeholder="Cloud basics" />
                </Field>
                <Field label="Body / description">
                  <textarea value={contentForm.body} onChange={(e) => setContentForm((p) => ({ ...p, body: e.target.value }))} className={textareaClass} />
                </Field>
                <Field label="Source">
                  <input value={contentForm.source} onChange={(e) => setContentForm((p) => ({ ...p, source: e.target.value }))} className={inputClass} placeholder="Source system or reference" />
                </Field>
                <Field label="Source metadata (JSON)" hint="Any extra fields the portal needs">
                  <textarea value={contentForm.metadataText} onChange={(e) => setContentForm((p) => ({ ...p, metadataText: e.target.value }))} className={`${textareaClass} font-mono`} />
                </Field>
                <Button type="submit" disabled={busy === "content"} className={`${primaryButton} w-full`}>
                  {busy === "content" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editingContent ? "Save changes" : "Add content"}
                </Button>
              </form>
            </div>
          )}

          {/* ------------------------------ Leaderboard ------------------------------ */}
          {section === "leaderboard" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Filter by assessment">
                  <select value={boardAssessmentId} onChange={(e) => changeBoardAssessment(e.target.value)} className={`${inputClass} min-w-[14rem]`}>
                    <option value="">All assessments</option>
                    {assessments.map((row, index) => {
                      const item = assessmentFromRow(row);
                      return <option key={item.id || `board-a-${index}`} value={item.id}>{item.name || "Untitled assessment"}</option>;
                    })}
                  </select>
                </Field>
                <Field label="Filter by cohort">
                  <select value={boardCohortId} onChange={(e) => changeBoardCohort(e.target.value)} className={`${inputClass} min-w-[14rem]`}>
                    <option value="">All cohorts</option>
                    {cohorts.map((row, index) => {
                      const item = cohortFromRow(row);
                      return <option key={item.id || `board-c-${index}`} value={item.id}>{item.name || "Untitled cohort"}</option>;
                    })}
                  </select>
                </Field>
              </div>
              {leaderboard.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-xs text-muted-foreground">
                  No results for the selected filters.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-border">
                  <table className="w-full min-w-[52rem] text-left text-xs">
                    <thead className="bg-muted/60 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2.5">Rank</th>
                        <th className="px-3 py-2.5">Employee</th>
                        <th className="px-3 py-2.5">Assessment</th>
                        <th className="px-3 py-2.5">Cohort</th>
                        <th className="px-3 py-2.5">Score</th>
                        <th className="px-3 py-2.5">Time</th>
                        <th className="px-3 py-2.5">Violations</th>
                        <th className="px-3 py-2.5">Auto-submitted</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {leaderboard.map((row, index) => {
                        const employee = pick(row, "employeeName", "employee_name", "name", "employeeId", "employee_id", "employee");
                        const employeeLabel = typeof employee === "object" ? pick(employee, "name", "full_name", "employeeId", "employee_id", "id") : employee;
                        return (
                          <tr key={text(pick(row, "id", "_id", "attemptId", "attempt_id", "testId", "test_id")) || `board-${index}`} className="hover:bg-muted/30">
                            <td className="px-3 py-2.5 font-bold text-foreground">{text(pick(row, "rank", "position") ?? index + 1)}</td>
                            <td className="px-3 py-2.5 font-semibold text-foreground">{formatCell(employeeLabel)}</td>
                            <td className="px-3 py-2.5 text-muted-foreground">{formatCell(pick(row, "assessmentName", "assessment_name", "assessmentTitle", "assessment_title", "assessment"))}</td>
                            <td className="px-3 py-2.5 text-muted-foreground">{formatCell(pick(row, "cohortName", "cohort_name", "cohort"))}</td>
                            <td className="px-3 py-2.5 font-bold text-foreground">{formatCell(pick(row, "score", "marks", "totalScore", "total_score"))}</td>
                            <td className="px-3 py-2.5 text-muted-foreground">{formatTime(pick(row, "timeSeconds", "time_seconds", "durationSeconds", "duration_seconds", "timeTaken", "time_taken", "time"))}</td>
                            <td className="px-3 py-2.5 text-muted-foreground">{formatCell(pick(row, "violations", "proctoringViolations", "proctoring_violations", "violationCount", "violation_count") ?? 0)}</td>
                            <td className="px-3 py-2.5 text-muted-foreground">
                              {formatCell(bool(pick(row, "autoSubmitted", "auto_submitted", "autoSubmit", "auto_submit", "autoSubmittedByProctor", "auto_submitted_by_proctor")))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
