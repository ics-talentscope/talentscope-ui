"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { BookOpen, Sparkles, ChevronRight, Clock, Zap, ArrowLeft, AlertCircle, Loader2, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageLoadingSkeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type DifficultyLevel = "beginner" | "intermediate" | "advanced" | "expert";

interface TopicSource {
  name: string;
  title: string;
  url: string;
  description?: string;
}

interface TopicItem {
  id: string;
  title: string;
  difficulty: DifficultyLevel;
  estimated_minutes: number;
  best_pct?: number;
  attempts?: number;
  sources?: TopicSource[];
}

function formatDisplayTitle(raw: string): string {
  if (!raw) return "Core Concepts";
  if (!raw.includes("-") && !raw.includes("_")) return raw;
  const acronyms: Record<string, string> = {
    ai: "AI",
    ml: "ML",
    ds: "Data Science",
    dl: "Deep Learning",
    nlp: "NLP",
    cv: "Computer Vision",
    genai: "Generative AI",
    sql: "SQL",
    llm: "LLM",
    mlops: "MLOps",
    bfs: "BFS",
    dfs: "DFS",
    "a*": "A*",
  };
  return raw
    .replace(/[-_]+/g, " ")
    .split(" ")
    .map((w, idx) => {
      const lower = w.toLowerCase();
      if (acronyms[lower]) return acronyms[lower];
      if (idx > 0 && ["a", "an", "the", "in", "on", "at", "for", "to", "by", "and", "or", "of", "vs"].includes(lower)) {
        return lower;
      }
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

function resolveTopicSources(topic: TopicItem, subjectTitle: string): TopicSource[] {
  if (topic.sources && topic.sources.length >= 2) {
    return topic.sources.slice(0, 2);
  }
  const cleanTitle = formatDisplayTitle(topic.title || "Topic");
  const slug = cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return [
    {
      name: "GeeksforGeeks",
      title: `${cleanTitle} Tutorial`,
      url: `https://www.geeksforgeeks.org/${slug}/`,
    },
    {
      name: "Wikipedia",
      title: cleanTitle,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(cleanTitle.replace(/ /g, "_"))}`,
    },
  ];
}

interface ModuleItem {
  id: string;
  title: string;
  topics: TopicItem[];
}

interface SubjectDetail {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  modules: ModuleItem[];
}

const diffColors: Record<DifficultyLevel, string> = {
  beginner:    "bg-emerald-100  text-emerald-700  border-emerald-200",
  intermediate:"bg-blue-100    text-blue-700    border-blue-200",
  advanced:    "bg-amber-100   text-amber-700   border-amber-200",
  expert:      "bg-red-100    text-red-700    border-red-200",
};

const diffLabels: Record<DifficultyLevel, string> = {
  beginner: "Basic",
  intermediate: "Intermediate",
  advanced: "High",
  expert: "High",
};

// ---------------------------------------------------------------------------
// Hook: fetch a single subject with its full module + topic tree
// ---------------------------------------------------------------------------

function useSubjectDetail(subjectId: string, token: string) {
  const [detail, setDetail] = useState<SubjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const r = await fetch("/api/employee/catalog", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!r.ok) throw new Error("Failed to load catalog.");
        const subjects: any[] = await r.json();
        const found = subjects.find((s) => s.id === subjectId);
        if (!found) throw new Error("Subject not found.");
        if (!cancelled) setDetail(found);
      } catch (e: any) {
        if (!cancelled) setErr(e.message || "Unable to load subject.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [subjectId, token]);

  return { detail, loading, err };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SubjectDetailPage() {
  const params  = useParams();
  const router  = useRouter();
  const subjectId = Array.isArray(params.id) ? params.id[0] : (params.id as string);

  const [token, setToken] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [startingTopicId, setStartingTopicId] = useState<string | null>(null);

  useEffect(() => {
    setToken(window.localStorage.getItem("employee_token") ?? "");
  }, []);

  const { detail, loading, err } = useSubjectDetail(subjectId, token);

  const handleTakeTest = (topicId: string) => async () => {
    if (startingTopicId) return;
    setActionError(null);
    setStartingTopicId(topicId);
    try {
      const r = await fetch(`/api/employee/learning/${topicId}/ai-quiz`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error || "Failed to start test.");
      const test_id = body.test_id;
      if (typeof test_id !== "string" || !test_id) throw new Error("The test could not be prepared. Please try again.");
      router.push(`/employee/tests/${test_id}?buffer=1`);
    } catch (e: any) {
      setActionError(e.message || "Failed to start test.");
    } finally {
      setStartingTopicId(null);
    }
  };

  // -------------------------------------------------------------------------
  // Render — loading
  // -------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <PageLoadingSkeleton label="Loading subject" variant="cards" />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render — error
  // -------------------------------------------------------------------------
  if (err || !detail) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center px-4">
        <p className="text-red-600 font-medium">{err || "Subject not found."}</p>
        <Link href="/employee/learn">
          <Button variant="outline" className="mt-4 rounded-xl border-indigo-200 text-indigo-700"><ArrowLeft className="w-4 h-4 mr-1"/> Back to catalog</Button>
        </Link>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render — subject detail
  // -------------------------------------------------------------------------
  const totalTopics = detail.modules.reduce((sum, m) => sum + m.topics.length, 0);

  return (
    <div className="max-w-full mx-auto">

      {actionError && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300 px-4 py-3 rounded-2xl flex items-center gap-3.5 shadow-sm animate-fade-in text-xs font-semibold mb-6">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span className="flex-grow">{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-red-400 hover:text-red-650 font-bold ml-auto px-1.5 text-xs">✕</button>
        </div>
      )}

      {/* ── Breadcrumb ────────────────────────────────────────────── */}
      <div className="mb-6 flex items-center gap-2 text-sm">
        <Link href="/employee/learn" className="text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1.5 font-medium">
          <ArrowLeft className="w-3.5 h-3.5" /> All subjects
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-slate-600 font-medium">{detail.title}</span>
      </div>

      {/* ── Subject header ────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-border bg-card shadow-soft p-8 mb-8"
      >
        <div className="flex items-start gap-4">
          <div
            className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg shadow-indigo-500/25"
            style={{ backgroundColor: detail.color }}
          >
            <BookOpen className="h-7 w-7" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-extrabold text-foreground leading-tight">{detail.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{detail.description}</p>
            <p className="mt-2 text-xs text-primary dark:text-violet-400 font-semibold">{detail.modules.length} module{detail.modules.length !== 1 ? "s" : ""} · {totalTopics} topics</p>
          </div>
        </div>
      </motion.div>

      {/* ── Modules ───────────────────────────────────────────────── */}
      {detail.modules.map((mod, mIdx) => (
        <motion.div
          key={mod.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: mIdx * 0.1 }}
          className="mb-8"
        >
          <h2 className="text-base font-bold text-foreground mb-3 pb-2 border-b border-border">
            {mod.title}
            <span className="ml-2 text-xs font-semibold text-muted-foreground">
              {mod.topics.length} topic{mod.topics.length !== 1 ? "s" : ""}
            </span>
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mod.topics.map((topic, tIdx) => {
              const sources = resolveTopicSources(topic, detail.title);
              return (
                <motion.div
                  key={topic.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: mIdx * 0.1 + tIdx * 0.05 }}
                >
                  <Card
                    className="group flex flex-col justify-between gap-4 rounded-3xl border border-border bg-card p-5 sm:p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-card h-full"
                  >
                    <div>
                      {/* Top Header: Title on Left, Difficulty Badge on TOP RIGHT */}
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-base font-bold text-foreground leading-snug flex-1 min-w-0">
                          {formatDisplayTitle(topic.title)}
                        </h3>
                        {/* Difficulty mentioned at top right */}
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-2.5 py-0.5 border font-bold shrink-0 uppercase tracking-wider ${diffColors[topic.difficulty]}`}
                        >
                          {diffLabels[topic.difficulty]}
                        </Badge>
                      </div>

                      {/* Metadata badges */}
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground border border-border font-medium">
                          <Clock className="w-2.5 h-2.5" /> {topic.estimated_minutes} min
                        </Badge>
                        <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground border border-border font-medium">
                          <BookOpen className="w-2.5 h-2.5" /> 10 MCQs
                        </Badge>
                        {topic.attempts != null && topic.attempts > 0 && (
                          <Badge variant="outline" className="text-[10px] gap-1 text-primary border-border font-semibold bg-indigo-50 dark:bg-slate-950/20">
                            <Zap className="w-2.5 h-2.5" /> Best {topic.best_pct ?? 0}%
                          </Badge>
                        )}
                      </div>

                      {/* 2 Learning Sources Links */}
                      <div className="mt-4 pt-3 border-t border-border/70">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                          <ExternalLink className="w-3 h-3 text-primary" />
                          <span>2 Learning Sources:</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {sources.slice(0, 2).map((s, sIdx) => (
                            <a
                              key={sIdx}
                              href={s.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title={s.title || s.name}
                              className="inline-flex items-center justify-between gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-indigo-50 hover:text-primary dark:bg-slate-800 dark:hover:bg-slate-700/80 transition-colors border border-border group/link"
                            >
                              <span className="truncate">{s.name}</span>
                              <ExternalLink className="w-3 h-3 text-muted-foreground group-hover/link:text-primary shrink-0 opacity-70" />
                            </a>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="mt-2 pt-3 border-t border-border/50 flex flex-col gap-2">
                      <Link href={`/employee/learn/${subjectId}/source/${topic.id}`} className="w-full">
                        <Button
                          size="sm"
                          className="w-full gap-1.5 bg-primary hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/30 transition-all"
                        >
                          <BookOpen className="w-3.5 h-3.5" /> Study Source Guide &amp; Notes →
                        </Button>
                      </Link>

                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full gap-1 text-xs font-semibold rounded-xl border-border hover:bg-slate-100 dark:hover:bg-slate-800 text-muted-foreground hover:text-foreground transition-all"
                        onClick={handleTakeTest(topic.id)}
                        disabled={startingTopicId !== null}
                      >
                        {startingTopicId === topic.id ? (
                          <><Loader2 className="w-3 h-3 animate-spin" /> Preparing test…</>
                        ) : (
                          <><Sparkles className="w-3 h-3 text-amber-500" /> Quick Take Test</>
                        )}
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              );
            })}

            {mod.topics.length === 0 && (
              <p className="text-sm text-slate-500 font-medium col-span-full">No topics in this module yet.</p>
            )}
          </div>
        </motion.div>
      ))}

    </div>
  );
}
