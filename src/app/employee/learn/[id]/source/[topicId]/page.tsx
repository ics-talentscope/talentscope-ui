"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  BookOpen,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  FileText,
  HelpCircle,
  Compass,
  Award,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageLoadingSkeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TopicSourceDetail, DifficultyLevel } from "@/types/learning";

const diffColors: Record<DifficultyLevel, string> = {
  beginner: "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  intermediate: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
  advanced: "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  expert: "bg-red-100 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800",
};

const diffLabels: Record<DifficultyLevel, string> = {
  beginner: "Basic / Beginner",
  intermediate: "Intermediate",
  advanced: "High / Advanced",
  expert: "Expert",
};

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

const MIN_RECOMMENDED_SECONDS = 30; // Suggested minimum study time before assessment

export default function TopicSourcePage() {
  const params = useParams();
  const router = useRouter();

  const subjectId = Array.isArray(params.id) ? params.id[0] : (params.id as string);
  const topicId = Array.isArray(params.topicId) ? params.topicId[0] : (params.topicId as string);

  const [token, setToken] = useState("");
  const [sourceData, setSourceData] = useState<TopicSourceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [startingTest, setStartingTest] = useState(false);

  // Reading time and source visit tracking
  const [secondsSpent, setSecondsSpent] = useState(0);
  const [visitedSources, setVisitedSources] = useState<Record<number, boolean>>({});
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const t = window.localStorage.getItem("employee_token") ?? "";
    setToken(t);
  }, []);

  // Fetch topic source data
  useEffect(() => {
    if (!topicId) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const res = await fetch(`/api/employee/learning/${topicId}/source`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error("Failed to load topic source material.");
        }

        const data: TopicSourceDetail = await res.json();
        if (!cancelled) {
          setSourceData(data);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || "Unable to load topic source material.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [topicId, token]);

  // Active reading timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setSecondsSpent((prev) => prev + 1);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleSourceClick = (index: number) => {
    setVisitedSources((prev) => ({ ...prev, [index]: true }));
  };

  const handleStartTest = async () => {
    if (startingTest) return;
    setActionError(null);
    setStartingTest(true);

    try {
      const res = await fetch(`/api/employee/learning/${topicId}/ai-quiz`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "Failed to start assessment.");
      }

      const testId = body.test_id;
      if (typeof testId !== "string" || !testId) {
        throw new Error("Assessment could not be prepared. Please try again.");
      }

      router.push(`/employee/tests/${testId}?buffer=1`);
    } catch (err: any) {
      setActionError(err.message || "Failed to start assessment.");
      setStartingTest(false);
    }
  };

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <PageLoadingSkeleton label="Loading topic source guide" variant="cards" />
      </div>
    );
  }

  if (error || !sourceData) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center px-4">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-600 font-semibold text-lg">{error || "Topic source material not found."}</p>
        <Link href={`/employee/learn/${subjectId || "ai"}`}>
          <Button variant="outline" className="mt-5 rounded-xl border-indigo-200 text-indigo-700">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to subtopics
          </Button>
        </Link>
      </div>
    );
  }

  const sourcesList = sourceData.sources || [];
  const hasVisitedAnySource = Object.values(visitedSources).some(Boolean);
  const isTimeRecommendedMet = secondsSpent >= MIN_RECOMMENDED_SECONDS;

  return (
    <div className="max-w-5xl mx-auto pb-16">
      {actionError && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300 px-4 py-3 rounded-2xl flex items-center gap-3.5 shadow-sm mb-6 text-sm font-semibold">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <span className="flex-grow">{actionError}</span>
          <button
            onClick={() => setActionError(null)}
            className="text-red-400 hover:text-red-650 font-bold ml-auto px-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Breadcrumb Navigation ──────────────────────────────────── */}
      <div className="mb-6 flex items-center flex-wrap gap-2 text-sm">
        <Link
          href="/employee/learn"
          className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 transition-colors flex items-center gap-1.5 font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> All Subjects
        </Link>
        <span className="text-slate-300 dark:text-slate-700">/</span>
        <Link
          href={`/employee/learn/${subjectId}`}
          className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 transition-colors font-medium"
        >
          {formatDisplayTitle(sourceData.subject_title || "Subject")}
        </Link>
        <span className="text-slate-300 dark:text-slate-700">/</span>
        <span className="text-slate-700 dark:text-slate-300 font-bold">{formatDisplayTitle(sourceData.topic_title)}</span>
        <span className="text-slate-300 dark:text-slate-700">/</span>
        <span className="text-muted-foreground font-medium">Study &amp; Source Guide</span>
      </div>

      {/* ── Topic Header with Difficulty at Top Right ─────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-border bg-card shadow-soft p-6 sm:p-8 mb-8 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-950/20 dark:to-violet-950/20 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 relative z-10">
          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 mb-3 text-xs font-bold text-primary dark:text-indigo-300">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              <span>OFFICIAL TEST STUDY MATERIAL</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground leading-tight">
              {formatDisplayTitle(sourceData.topic_title)}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground font-medium">
              Subject: <span className="text-foreground font-semibold">{formatDisplayTitle(sourceData.subject_title)}</span>
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground font-semibold">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-border">
                <Clock className="w-3.5 h-3.5 text-primary" />
                Reading: ~{sourceData.estimated_minutes || 20} min
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-border">
                <FileText className="w-3.5 h-3.5 text-primary" />
                ~{sourceData.word_count || 370} words
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-border">
                <Award className="w-3.5 h-3.5 text-primary" />
                Assessment: 10 Questions
              </span>
            </div>
          </div>

          {/* Difficulty Badge at Top Right */}
          <div className="flex flex-col sm:items-end gap-2 shrink-0">
            <Badge
              variant="outline"
              className={`text-xs px-3 py-1 rounded-full border font-bold uppercase tracking-wider shadow-sm ${diffColors[sourceData.difficulty] || diffColors.intermediate}`}
            >
              Difficulty: {diffLabels[sourceData.difficulty] || "Intermediate"}
            </Badge>
            <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-xl bg-indigo-50/80 dark:bg-slate-850 border border-indigo-100 dark:border-slate-800 text-indigo-700 dark:text-indigo-300">
              <Clock className="w-3.5 h-3.5 animate-pulse text-indigo-600 dark:text-indigo-400" />
              <span>Time on Guide: {formatTimer(secondsSpent)}</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Key Test Requirements ("What all needs to be known for the test") ── */}
      {sourceData.key_points && sourceData.key_points.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-8"
        >
          <Card className="rounded-3xl border-2 border-indigo-150 dark:border-indigo-900/60 bg-gradient-to-br from-indigo-50/50 via-card to-violet-50/30 dark:from-slate-900 dark:to-slate-900/80 p-6 sm:p-7 shadow-soft">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="h-9 w-9 rounded-2xl bg-indigo-100 dark:bg-indigo-950/80 flex items-center justify-center text-primary">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">What Needs to Be Known for the Assessment</h2>
                <p className="text-xs text-muted-foreground font-medium">
                  The test questions directly evaluate the milestones, concepts, and principles outlined below:
                </p>
              </div>
            </div>

            <ul className="grid gap-2.5 sm:grid-cols-2 mt-3">
              {sourceData.key_points.map((pt, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2.5 p-3 rounded-2xl bg-card dark:bg-slate-850/80 border border-border text-xs leading-relaxed font-medium text-foreground"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{pt}</span>
                </li>
              ))}
            </ul>
          </Card>
        </motion.div>
      )}

      {/* ── Core Source Explanation (300-500 words) ──────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-8"
      >
        <Card className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-soft">
          <div className="flex items-center justify-between gap-3 pb-4 mb-6 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-2xl bg-indigo-50 dark:bg-slate-800 flex items-center justify-center text-primary">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Topic Study Material</h2>
                <p className="text-xs text-muted-foreground font-medium">
                  Detailed ~{sourceData.word_count || 370}-word study guide prepared for this assessment
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              Required Reading
            </span>
          </div>

          <div className="space-y-4 text-sm leading-7 text-foreground/90 font-normal">
            {sourceData.explanation.split("\n\n").map((para, idx) => (
              <p key={idx} className="leading-relaxed">
                {para}
              </p>
            ))}
          </div>
        </Card>
      </motion.div>

      {/* ── Two External Reference Sources ──────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mb-8"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Compass className="w-5 h-5 text-primary" />
              External Reference Sources (2 Sources)
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">
              Authoritative references from where AI curated data. Click to open and spend time reading the sources:
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {sourcesList.map((src, idx) => (
            <Card
              key={idx}
              className="group flex flex-col justify-between rounded-3xl border border-indigo-100 dark:border-slate-800 bg-card p-5 sm:p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-card relative overflow-hidden"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-8 px-2.5 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-primary dark:text-indigo-300 font-bold text-xs border border-indigo-100 dark:border-indigo-800">
                      Source {idx + 1} · {src.name}
                    </span>
                  </div>
                  {visitedSources[idx] && (
                    <Badge variant="outline" className="text-[10px] gap-1 text-emerald-700 bg-emerald-50 border-emerald-200 font-semibold">
                      <CheckCircle2 className="w-2.5 h-2.5" /> Visited
                    </Badge>
                  )}
                </div>

                <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors leading-snug">
                  {src.title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {src.description || "Detailed article covering theoretical background, principles, and historical milestones."}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-border/60">
                <a
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleSourceClick(idx)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-primary hover:text-white dark:bg-slate-800 dark:hover:bg-primary text-foreground transition-all duration-200 shadow-sm"
                >
                  <span>Open in {src.name}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </Card>
          ))}
        </div>
      </motion.div>

      {/* ── Test Access & Launch Gate ───────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="rounded-3xl border-2 border-indigo-200 dark:border-indigo-900 bg-gradient-to-r from-indigo-50/80 via-card to-violet-50/80 dark:from-slate-900 dark:to-slate-850 p-6 sm:p-8 shadow-card">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex-1 min-w-0">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold border border-emerald-200 dark:border-emerald-800 mb-2">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Test Unlocked After Source Review</span>
              </div>
              <h2 className="text-xl font-extrabold text-foreground leading-tight">
                Ready for the {formatDisplayTitle(sourceData.topic_title)} Assessment?
              </h2>
              <p className="mt-1 text-xs text-muted-foreground font-medium max-w-xl leading-relaxed">
                All 10 assessment questions are directly based on the study guide and external reference sources above. Make sure you have reviewed the key milestones and principles before starting.
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-medium text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Study material reviewed
                </span>
                <span className="flex items-center gap-1.5">
                  {hasVisitedAnySource ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Clock className="w-4 h-4 text-amber-500" />
                  )}
                  External sources {hasVisitedAnySource ? "explored" : "ready to explore"}
                </span>
                <span className="flex items-center gap-1.5">
                  {isTimeRecommendedMet ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Clock className="w-4 h-4 text-indigo-500" />
                  )}
                  Reading timer: {formatTimer(secondsSpent)}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 shrink-0">
              <Button
                size="lg"
                onClick={handleStartTest}
                disabled={startingTest}
                className="gap-2 bg-primary hover:from-indigo-700 hover:to-violet-700 text-white font-bold text-sm px-7 py-3 rounded-2xl shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 transition-all duration-200"
              >
                {startingTest ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Preparing Assessment…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" /> Start Assessment (10 Questions) →
                  </>
                )}
              </Button>

              <Link href={`/employee/learn/${subjectId}`}>
                <Button variant="outline" className="w-full text-xs font-semibold rounded-2xl border-border">
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to Subtopics
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}

