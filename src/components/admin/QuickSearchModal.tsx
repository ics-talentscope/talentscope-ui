"use client";

import { useState, type FormEvent } from "react";
import { Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  calculateSkillMatch,
  canonicalSkillKey,
  candidateMatchText,
  compileJdForMatch,
  employeeMatchText,
  extractJdMandatorySkills,
  extractJdRequiredExperienceYears,
  profileExperienceYears,
  type SkillMatchResult,
} from "@/lib/skill-match";

const QUICK_SEARCH_PAGE_SIZE = 20;
const QUICK_SEARCH_RESULT_CAP = 50;

type SearchSource = "corp-pool" | "external" | "all";

type QuickSearchPerson = {
  key: string;
  name: string;
  employeeId: string;
  email: string;
  source: "Corp Pool" | "External Candidate";
  matchedSkills: string[];
  requestedSkillsCount: number;
  mandatorySkillsCount: number;
  missingMandatorySkills: string[];
  requiredExperienceYears: number | null;
  verifiedExperienceYears: number | null;
  score: number;
  qualified: boolean;
  rationale: string;
};

type Props = {
  employees: any[];
  candidates: any[];
  jds: Array<{
    id: string;
    fileName?: string;
    file_name?: string;
    jdText?: string;
    jd_text?: string;
  }>;
  initialJdId?: string;
  onClose: () => void;
};

function normalizeSkill(value: unknown): string {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function skillValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => skillValues(item));
  }
  if (typeof value !== "string") return [];
  return value
    .split(/[,;\n|]+/)
    .map((skill) => skill.trim())
    .filter(Boolean);
}

function profileSkills(person: any, isCorpPool: boolean): string[] {
  if (isCorpPool) return skillValues(person.skills);
  const parsed = person.parsed?.skills || {};
  return [
    ...skillValues(person.skills),
    ...skillValues(person.extractedSkills),
    ...skillValues(person.extracted_skills),
    ...skillValues(parsed.technical),
    ...skillValues(parsed.tools),
    ...skillValues(parsed.languages),
    ...skillValues(parsed.other),
  ];
}

function profileIdentity(person: any, source: QuickSearchPerson["source"]): string {
  const employeeId = String(person.employee_id || person.employeeId || "")
    .trim()
    .replace(/^(\d+)\.0+$/, "$1")
    .toLowerCase();
  const email = String(person.email || person.parsed?.personal?.email || "").trim().toLowerCase();
  return employeeId || email || `${source}:${person.id || person.filename || person.file_name || person.full_name || person.name || "profile"}`;
}

function personName(person: any, isCorpPool: boolean): string {
  if (isCorpPool) return String(person.full_name || person.name || "Unnamed employee");
  return String(person.parsed?.personal?.fullName || person.full_name || person.name || person.filename || "Unnamed candidate");
}

function mandatorySkillGaps(match: SkillMatchResult, mandatorySkills: string[]): string[] {
  return mandatorySkills.filter((skill) => {
    const key = canonicalSkillKey(skill);
    const item = match.skillBreakdown.find((row) => canonicalSkillKey(row.skill) === key);
    return !item || item.credit < 0.7;
  });
}

export function QuickSearchModal({ employees, candidates, jds, initialJdId, onClose }: Props) {
  const [jdId, setJdId] = useState(() =>
    initialJdId && jds.some((jd) => jd.id === initialJdId) ? initialJdId : ""
  );
  const [source, setSource] = useState<SearchSource>("all");
  const [skillsInput, setSkillsInput] = useState("");
  const [peopleNeeded, setPeopleNeeded] = useState("20");
  const [error, setError] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<QuickSearchPerson[]>([]);
  const [matchingCount, setMatchingCount] = useState(0);
  const [resultLimit, setResultLimit] = useState(0);
  const [page, setPage] = useState(1);

  const runSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const requestedSkills = Array.from(
      new Map(
        skillsInput
          .split(/[,\n;]+/)
          .map((skill) => skill.trim())
          .filter(Boolean)
          .map((skill) => [normalizeSkill(skill), skill] as const)
      ).values()
    );
    if (requestedSkills.length < 3) {
      setError("Enter at least 3 distinct skills.");
      return;
    }

    const requestedCount = Number(peopleNeeded);
    if (!Number.isInteger(requestedCount) || requestedCount < 1 || requestedCount > QUICK_SEARCH_RESULT_CAP) {
      setError(`Enter a whole number from 1 to ${QUICK_SEARCH_RESULT_CAP}.`);
      return;
    }

    setError("");
    setIsSearching(true);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    const selectedJd = jds.find((jd) => jd.id === jdId);
    const jdText = String(selectedJd?.jdText || selectedJd?.jd_text || "").trim();
    const mandatorySkills = jdText ? extractJdMandatorySkills(jdText) : [];
    const requiredExperienceYears = jdText ? extractJdRequiredExperienceYears(jdText) : null;
    const evaluationText = jdText
      ? `${jdText}\n\nPrimary Skills: ${requestedSkills.join(", ")}`
      : "";
    const compiledJd = evaluationText ? compileJdForMatch(evaluationText) : undefined;
    const people = [
      ...(source !== "external"
        ? employees.map((person) => ({ person, source: "Corp Pool" as const, isCorpPool: true }))
        : []),
      ...(source !== "corp-pool"
        ? candidates.map((person) => ({ person, source: "External Candidate" as const, isCorpPool: false }))
        : []),
    ];
    const ranked = new Map<string, QuickSearchPerson>();

    for (const entry of people) {
      const availableSkills = new Set(
        profileSkills(entry.person, entry.isCorpPool).map(normalizeSkill).filter(Boolean)
      );
      const matchedSkills = requestedSkills.filter((skill) => availableSkills.has(normalizeSkill(skill)));
      if (matchedSkills.length === 0) continue;

      const profileText = entry.isCorpPool
        ? employeeMatchText(entry.person)
        : candidateMatchText(entry.person);
      const periods = entry.person.experience || entry.person.parsed?.experience;
      const statedYears =
        entry.person.yearsExperience ??
        entry.person.years_experience ??
        entry.person.parsed?.yearsExperience ??
        entry.person.parsed?.years_experience;
      const verifiedYears = profileExperienceYears(periods, statedYears, profileText);
      const match = evaluationText
        ? calculateSkillMatch(profileText, evaluationText, compiledJd, verifiedYears)
        : null;
      const score = match
        ? match.score
        : Math.round((matchedSkills.length / requestedSkills.length) * 100);
      const missingMandatorySkills = match
        ? mandatorySkillGaps(match, mandatorySkills)
        : [];
      const experiencePasses =
        requiredExperienceYears == null ||
        (verifiedYears != null && verifiedYears >= requiredExperienceYears);
      const qualified = match
        ? score >= 60 && matchedSkills.length === requestedSkills.length && missingMandatorySkills.length === 0 && experiencePasses
        : matchedSkills.length === requestedSkills.length;
      const employeeId = String(entry.person.employee_id || entry.person.employeeId || "").trim();
      const email = String(entry.person.email || entry.person.parsed?.personal?.email || "").trim();
      const candidate: QuickSearchPerson = {
        key: profileIdentity(entry.person, entry.source),
        name: personName(entry.person, entry.isCorpPool),
        employeeId,
        email,
        source: entry.source,
        matchedSkills,
        requestedSkillsCount: requestedSkills.length,
        mandatorySkillsCount: mandatorySkills.length,
        missingMandatorySkills,
        requiredExperienceYears,
        verifiedExperienceYears: verifiedYears,
        score,
        qualified,
        rationale: match?.rationale || `${matchedSkills.length} of ${requestedSkills.length} requested skills are listed in the profile.`,
      };
      const previous = ranked.get(candidate.key);
      if (
        !previous ||
        candidate.score > previous.score ||
        (candidate.score === previous.score && candidate.matchedSkills.length > previous.matchedSkills.length)
      ) {
        ranked.set(candidate.key, candidate);
      }
    }

    const ordered = Array.from(ranked.values()).sort(
      (a, b) =>
        b.score - a.score ||
        Number(b.qualified) - Number(a.qualified) ||
        b.matchedSkills.length - a.matchedSkills.length ||
        a.name.localeCompare(b.name)
    );
    const limit = Math.min(requestedCount, QUICK_SEARCH_RESULT_CAP);
    setMatchingCount(ordered.length);
    setResultLimit(limit);
    setResults(ordered.slice(0, limit));
    setPage(1);
    setIsSearching(false);
  };

  const pageCount = Math.max(1, Math.ceil(results.length / QUICK_SEARCH_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const firstItem = results.length ? (currentPage - 1) * QUICK_SEARCH_PAGE_SIZE + 1 : 0;
  const lastItem = Math.min(currentPage * QUICK_SEARCH_PAGE_SIZE, results.length);
  const pageResults = results.slice(firstItem - 1, lastItem);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-search-title"
    >
      <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-border bg-card text-foreground shadow-2xl">
        <div className="flex items-center justify-between bg-primary px-5 py-4 text-white sm:px-6">
          <div>
            <h2 id="quick-search-title" className="text-sm font-bold tracking-wide">Quick Search</h2>
            <p className="mt-1 text-[11px] text-white/75">Find profiles using listed skills and verified JD/BR checkpoints.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-white/80 hover:bg-white/10 hover:text-white" aria-label="Close Quick Search">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-4 sm:p-6">
          <form onSubmit={runSearch} className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-1">
              <span className="text-[11px] font-bold text-muted-foreground">JB/BR (optional)</span>
              <select
                value={jdId}
                onChange={(event) => setJdId(event.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-indigo-300"
              >
                <option value="">No JD/BR — score requested skills only</option>
                {jds.map((jd) => (
                  <option key={jd.id} value={jd.id}>{jd.fileName || jd.file_name || jd.id}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-[11px] font-bold text-muted-foreground">Search source</span>
              <select
                value={source}
                onChange={(event) => setSource(event.target.value as SearchSource)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-indigo-300"
              >
                <option value="corp-pool">Corp Pool</option>
                <option value="external">External Candidates</option>
                <option value="all">All</option>
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-[11px] font-bold text-muted-foreground">No. of people needed (1–50)</span>
              <input
                type="number"
                min={1}
                max={QUICK_SEARCH_RESULT_CAP}
                step={1}
                value={peopleNeeded}
                onChange={(event) => setPeopleNeeded(event.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </label>

            <div className="flex items-end">
              <Button type="submit" disabled={isSearching} className="w-full rounded-xl">
                <Search className="mr-1.5 h-4 w-4" />
                {isSearching ? "Searching..." : "Find Matches"}
              </Button>
            </div>

            <label className="space-y-1 md:col-span-2 xl:col-span-4">
              <span className="text-[11px] font-bold text-muted-foreground">Skills needed</span>
              <textarea
                value={skillsInput}
                onChange={(event) => setSkillsInput(event.target.value)}
                rows={2}
                placeholder="Enter at least 3 skills, separated by commas or new lines"
                className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </label>
            <p className="text-[10px] text-muted-foreground md:col-span-2 xl:col-span-4">
              Skill matching ignores letter case. Results are ranked, show 20 per page, and are limited to the requested headcount (maximum 50).
            </p>
          </form>

          {error ? (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </p>
          ) : null}
          {isSearching ? (
            <p role="status" className="text-xs font-semibold text-muted-foreground">Comparing profiles against the requested skills and selected JD/BR checkpoints…</p>
          ) : null}

          {results.length > 0 ? (
            <>
              <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Showing {firstItem}–{lastItem} of {results.length} selected profiles from {matchingCount} matches
                  {matchingCount > resultLimit ? ` (limited to ${resultLimit})` : ""}.
                </span>
                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" variant="outline" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</Button>
                  <span aria-live="polite">Page {currentPage} of {pageCount}</span>
                  <Button type="button" size="sm" variant="outline" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Next</Button>
                </div>
              </div>
              <div className="overflow-auto rounded-2xl border border-border">
                <table className="w-full min-w-[900px] border-collapse text-left text-xs">
                  <thead className="sticky top-0 bg-slate-100 text-[10px] font-extrabold uppercase tracking-wide text-slate-500 dark:bg-slate-950">
                    <tr>
                      <th className="p-3">Profile</th>
                      <th className="p-3">Source</th>
                      <th className="p-3">Requested skills</th>
                      {jdId ? <th className="p-3">Mandatory skills</th> : null}
                      {jdId ? <th className="p-3">Experience</th> : null}
                      <th className="p-3">Score</th>
                      <th className="p-3">Screening status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {pageResults.map((result) => (
                      <tr key={result.key} className="align-top hover:bg-secondary/40">
                        <td className="p-3">
                          <div className="font-bold text-foreground">{result.name}</div>
                          <div className="mt-0.5 text-[10px] text-muted-foreground">
                            {result.employeeId || "No Employee ID"}{result.email ? ` · ${result.email}` : ""}
                          </div>
                        </td>
                        <td className="p-3 text-muted-foreground">{result.source}</td>
                        <td className="p-3">
                          <div className="font-semibold">{result.matchedSkills.length} / {result.requestedSkillsCount}</div>
                          <div className="mt-1 max-w-[220px] text-[10px] leading-relaxed text-muted-foreground" title={result.matchedSkills.join(", ")}>
                            {result.matchedSkills.join(", ")}
                          </div>
                        </td>
                        {jdId ? (
                          <td className="p-3">
                            {result.mandatorySkillsCount === 0 ? (
                              <span className="text-[10px] text-muted-foreground">Not specified</span>
                            ) : result.missingMandatorySkills.length === 0 ? (
                              <Badge className="border-0 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">Verified</Badge>
                            ) : (
                              <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400" title={result.missingMandatorySkills.join(", ")}>
                                Missing: {result.missingMandatorySkills.join(", ")}
                              </span>
                            )}
                          </td>
                        ) : null}
                        {jdId ? (
                          <td className="p-3 whitespace-nowrap">
                            {result.requiredExperienceYears == null
                              ? "Not specified"
                              : result.verifiedExperienceYears == null
                                ? `${result.requiredExperienceYears}+ yrs required; not verified`
                                : `${result.verifiedExperienceYears} yrs / ${result.requiredExperienceYears}+ yrs`}
                          </td>
                        ) : null}
                        <td className="p-3">
                          <span className={`font-black ${result.score >= 60 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`} title={result.rationale}>
                            {result.score}%
                          </span>
                        </td>
                        <td className="p-3">
                          <Badge className={`border-0 ${result.qualified ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"}`}>
                            {result.qualified ? "Qualified" : "Review"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : matchingCount === 0 && !isSearching ? (
            <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-xs font-semibold text-muted-foreground">
              {results.length === 0 && matchingCount === 0 && resultLimit > 0
                ? "No profiles list any of the requested skills."
                : "Enter your search conditions to see ranked profiles."}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
