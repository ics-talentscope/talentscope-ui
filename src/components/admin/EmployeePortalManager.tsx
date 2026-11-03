"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Upload, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;
type ProductConfig = {
  product: string;
  questionCount: number;
  bankQuestionCount: number;
};

const inputClass =
  "w-full rounded-xl border border-border bg-slate-50/50 dark:bg-slate-950 px-3 py-2.5 text-xs font-semibold text-foreground outline-none focus:ring-2 focus:ring-violet-200/50";

export function EmployeePortalManager({ onClose, fetcher }: { onClose: () => void; fetcher: Fetcher }) {
  const [products, setProducts] = useState<ProductConfig[]>([]);
  const [busy, setBusy] = useState<"user" | "bulk" | "bank" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [noticeWarning, setNoticeWarning] = useState(false);
  const [bulkResults, setBulkResults] = useState<Array<{ employeeId: string; error: string; row: number }>>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [designation, setDesignation] = useState("");
  const [product, setProduct] = useState("");
  const [rosterFile, setRosterFile] = useState<File | null>(null);
  const [bankFile, setBankFile] = useState<File | null>(null);
  const [bankProduct, setBankProduct] = useState("");
  const [bankCount, setBankCount] = useState("25");
  const [sheetName, setSheetName] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetcher("/api/admin/employee-portal");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Failed to load employee portal users.");
      setProducts(data.products || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load employee portal users.");
    }
  }, [fetcher]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addEmployee(event: React.FormEvent) {
    event.preventDefault();
    setBusy("user");
    setError("");
    setNotice("");
    setNoticeWarning(false);
    try {
      const response = await fetcher(
        "/api/admin/employee-portal/users",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ employeeId, name, email, designation, product }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not save this employee.");
      setNotice(
        `${data.created ? "Created" : "Updated"} ${data.employeeId}; ${data.questionCount} questions assigned for ${data.product}.` +
          (data.firstLoginPassword ? ` Initial password: Employee ID (${data.firstLoginPassword}).` : ""),
      );
      setEmployeeId("");
      setName("");
      setEmail("");
      setDesignation("");
      setProduct("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this employee.");
    } finally {
      setBusy(null);
    }
  }

  async function uploadRoster(event: React.FormEvent) {
    event.preventDefault();
    if (!rosterFile) return;
    setBusy("bulk");
    setError("");
    setNotice("");
    setNoticeWarning(false);
    setBulkResults([]);
    try {
      const form = new FormData();
      form.append("file", rosterFile);
      const response = await fetcher("/api/admin/employee-portal/users/bulk", { method: "POST", body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not upload this employee roster.");
      setNotice(`Bulk import finished: ${data.created} created, ${data.updated} updated, ${data.failed} failed.`);
      setBulkResults((data.results || []).filter((row: any) => !row.success));
      setRosterFile(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload this employee roster.");
    } finally {
      setBusy(null);
    }
  }

  async function uploadBank(event: React.FormEvent) {
    event.preventDefault();
    if (!bankFile) return;
    setBusy("bank");
    setError("");
    setNotice("");
    try {
      const form = new FormData();
      form.append("product", bankProduct);
      form.append("question_count", bankCount);
      form.append("sheet_name", sheetName);
      form.append("file", bankFile);
      const response = await fetcher("/api/admin/employee-portal/question-banks", { method: "POST", body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not upload this question bank.");
      const config = data.product;
      setNotice(`${config.product}: ${config.bankQuestionCount} questions imported; ${config.questionCount} assigned per employee.`);
      setBankFile(null);
      setSheetName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload this question bank.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm">
      <section className="relative max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-border bg-card p-5 shadow-2xl md:p-7">
        <button type="button" onClick={onClose} className="absolute right-5 top-5 text-muted-foreground hover:text-foreground" aria-label="Close">
          <X className="h-5 w-5" />
        </button>
        <header className="mb-6 pr-8">
          <h2 className="text-xl font-black text-foreground">Employee Portal Users</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Upload product question banks, create users, or import a roster. New users sign in with their Employee ID as the initial password; changing it after signing in is recommended.
          </p>
        </header>

        {(error || notice) && (
          <div className={`mb-4 rounded-xl border px-3 py-2.5 text-xs font-semibold ${error ? "border-red-300 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300" : noticeWarning ? "border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300" : "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"}`}>
            {error || notice}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <form onSubmit={uploadBank} className="space-y-3 rounded-2xl border border-border p-4">
            <h3 className="text-sm font-bold text-foreground">Configure a product question bank</h3>
            <label className="block text-[11px] font-bold text-muted-foreground">
              Product name
              <input required value={bankProduct} onChange={(event) => setBankProduct(event.target.value)} className={`${inputClass} mt-1`} placeholder="e.g. TPM Upskilling" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-[11px] font-bold text-muted-foreground">
                Questions per employee
                <input required type="number" min="1" value={bankCount} onChange={(event) => setBankCount(event.target.value)} className={`${inputClass} mt-1`} />
              </label>
              <label className="block text-[11px] font-bold text-muted-foreground">
                Sheet name (optional)
                <input value={sheetName} onChange={(event) => setSheetName(event.target.value)} className={`${inputClass} mt-1`} placeholder="Defaults to first sheet" />
              </label>
            </div>
            <input required type="file" accept=".xlsx,.xlsm,.csv" onChange={(event) => setBankFile(event.target.files?.[0] || null)} className="block w-full text-xs text-muted-foreground" />
            <p className="text-[10px] text-muted-foreground">Supports the sample workbook’s stacked question format and wide MCQ format.</p>
            <Button type="submit" disabled={!bankFile || busy !== null} className="h-9 w-full gap-2 bg-violet-600 text-xs font-bold text-white hover:bg-violet-700">
              {busy === "bank" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Upload question bank
            </Button>
          </form>

          <form onSubmit={addEmployee} className="space-y-3 rounded-2xl border border-border p-4">
            <h3 className="text-sm font-bold text-foreground">Provision one employee</h3>
            <div className="grid grid-cols-2 gap-3">
              <input required value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} className={inputClass} placeholder="Employee ID" />
              <input required value={name} onChange={(event) => setName(event.target.value)} className={inputClass} placeholder="Full name" />
              <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} placeholder="Email" />
              <input value={designation} onChange={(event) => setDesignation(event.target.value)} className={inputClass} placeholder="Role / designation" />
            </div>
            <label className="block text-[11px] font-bold text-muted-foreground">
              Product
              <select required value={product} onChange={(event) => setProduct(event.target.value)} className={`${inputClass} mt-1`}>
                <option value="">Select a configured product</option>
                {products.map((item) => <option key={item.product} value={item.product}>{item.product}</option>)}
              </select>
            </label>
            <div className="flex gap-2">
              <Button type="submit" disabled={busy !== null || products.length === 0} className="h-9 flex-1 gap-2 bg-primary text-xs font-bold text-white">
                {busy === "user" ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Save employee and assign questions
              </Button>
            </div>
          </form>

          <form onSubmit={uploadRoster} className="space-y-3 rounded-2xl border border-border p-4">
            <h3 className="text-sm font-bold text-foreground">Bulk upload employees</h3>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Upload CSV or Excel with columns Emp ID, Name, Email, Product, and optional Role. Existing employee passwords are preserved.
            </p>
            <input required type="file" accept=".xlsx,.xlsm,.csv" onChange={(event) => setRosterFile(event.target.files?.[0] || null)} className="block w-full text-xs text-muted-foreground" />
            <Button type="submit" disabled={!rosterFile || busy !== null} variant="outline" className="h-9 w-full gap-2 text-xs font-bold">
              {busy === "bulk" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Import roster
            </Button>
            {bulkResults.length > 0 && (
              <div className="max-h-28 space-y-1 overflow-y-auto text-[10px] text-red-600">
                {bulkResults.map((item, index) => <div key={`${item.row}-${index}`}>Row {item.row} · {item.employeeId || "Unknown ID"}: {item.error}</div>)}
              </div>
            )}
          </form>

          <div className="space-y-3 rounded-2xl border border-border p-4">
            <h3 className="text-sm font-bold text-foreground">Configured products</h3>
            {products.length === 0 ? <p className="text-xs text-muted-foreground">No product banks uploaded yet.</p> : (
              <div className="space-y-2">
                {products.map((item) => (
                  <div key={item.product} className="flex items-center justify-between gap-3 rounded-xl bg-secondary/60 px-3 py-2 text-xs">
                    <span className="font-bold text-foreground">{item.product}</span>
                    <span className="text-right text-muted-foreground">{item.questionCount} assigned / {item.bankQuestionCount} in bank</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </section>
    </div>
  );
}
