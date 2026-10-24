"use client";

import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck, Trash2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { ADMIN_PERMISSIONS, allPermissions, type AdminPermission, type AdminPermissions } from "@/lib/admin-accounts";

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;
type AdminRow = { email: string; hasPassword: boolean; permissions: AdminPermissions; aliases?: string[] };

function parseAliasInput(raw: string): string[] {
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.includes("@"));
}

const NEW_ADMIN_DEFAULTS: AdminPermissions = {
  ...allPermissions(false),
  requirements: true,
  corpPool: true,
  candidates: true,
  emailOutbox: true,
  changePassword: true,
};

const inputClass =
  "w-full rounded-xl border border-border bg-slate-50/50 dark:bg-slate-950 px-3 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-violet-200/50";

function PermissionTicks({
  value,
  onChange,
  idPrefix,
}: {
  value: AdminPermissions;
  onChange: (key: AdminPermission, checked: boolean) => void;
  idPrefix: string;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
      {ADMIN_PERMISSIONS.map(({ key, label }) => (
        <label key={key} htmlFor={`${idPrefix}-${key}`} className="flex items-start gap-2 text-xs text-foreground cursor-pointer select-none">
          <input
            id={`${idPrefix}-${key}`}
            type="checkbox"
            checked={value[key]}
            onChange={(e) => onChange(key, e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-violet-600"
          />
          <span>{label}</span>
        </label>
      ))}
    </div>
  );
}

function AdminCard({ admin, fetcher, onSaved }: { admin: AdminRow; fetcher: Fetcher; onSaved: (admins: AdminRow[], message: string) => void }) {
  const [permissions, setPermissions] = useState<AdminPermissions>(admin.permissions);
  const [aliasesText, setAliasesText] = useState((admin.aliases || []).join(", "));
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"save" | "remove" | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setPermissions(admin.permissions);
    setAliasesText((admin.aliases || []).join(", "));
  }, [admin.permissions, admin.aliases]);

  const nextAliases = parseAliasInput(aliasesText);
  const aliasesDirty =
    [...nextAliases].sort().join("|") !==
    [...(admin.aliases || [])].map((a) => a.toLowerCase()).sort().join("|");
  const dirty =
    password.length > 0 ||
    aliasesDirty ||
    ADMIN_PERMISSIONS.some(({ key }) => permissions[key] !== admin.permissions[key]);

  const save = async () => {
    setBusy("save");
    setError("");
    try {
      const res = await fetcher("/api/admin/admin-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: admin.email,
          permissions,
          password: password || undefined,
          aliases: parseAliasInput(aliasesText),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save changes.");
      setPassword("");
      onSaved(data.admins, `Saved access for ${admin.email}.`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Remove admin panel access for ${admin.email}? They will no longer be able to sign in with password or Microsoft SSO.`)) return;
    setBusy("remove");
    setError("");
    try {
      const res = await fetcher(`/api/admin/admin-accounts?email=${encodeURIComponent(admin.email)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not remove this admin.");
      onSaved(data.admins, `Removed ${admin.email}.`);
    } catch (err: any) {
      setError(err.message);
      setBusy(null);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-bold text-foreground truncate">{admin.email}</div>
          <div className="text-[11px] text-muted-foreground font-semibold">
            {admin.hasPassword
              ? "Can sign in with Microsoft SSO or password."
              : "SSO only — can sign in with Microsoft (no password set)."}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={remove}
          disabled={busy !== null}
          className="h-8 gap-1.5 text-xs text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/30"
        >
          {busy === "remove" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          Remove
        </Button>
      </div>

      <PermissionTicks
        idPrefix={admin.email}
        value={permissions}
        onChange={(key, checked) => setPermissions((prev) => ({ ...prev, [key]: checked }))}
      />

      <div className="space-y-1">
        <label htmlFor={`${admin.email}-aliases`} className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
          Microsoft / Entra aliases (optional)
        </label>
        <input
          id={`${admin.email}-aliases`}
          type="text"
          autoComplete="off"
          value={aliasesText}
          onChange={(e) => setAliasesText(e.target.value)}
          placeholder="e.g. aryan.mishra@infinite.com if account email differs"
          className={inputClass}
        />
        <p className="text-[10px] text-muted-foreground">
          Comma-separated. SSO matches these UPNs to this admin row.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end gap-3 pt-1">
        <div className="flex-1 space-y-1">
          <label htmlFor={`${admin.email}-password`} className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
            Set a new password (optional)
          </label>
          <PasswordInput
            id={`${admin.email}-password`}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Leave empty to keep their current password"
            className={inputClass}
          />
        </div>
        <Button
          size="sm"
          onClick={save}
          disabled={!dirty || busy !== null}
          className="h-10 px-5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-xs"
        >
          {busy === "save" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save changes"}
        </Button>
      </div>
      {error && <div className="text-xs font-semibold text-red-600">{error}</div>}
    </div>
  );
}

export function AdminAccessManager({ onClose, fetcher }: { onClose: () => void; fetcher: Fetcher }) {
  const [admins, setAdmins] = useState<AdminRow[] | null>(null);
  const [superAdmin, setSuperAdmin] = useState("");
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");

  const [newEmail, setNewEmail] = useState("");
  const [newAliases, setNewAliases] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPermissions, setNewPermissions] = useState<AdminPermissions>(NEW_ADMIN_DEFAULTS);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const res = await fetcher("/api/admin/admin-accounts", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not load admin accounts.");
      setAdmins(data.admins);
      setSuperAdmin(data.superAdmin);
    } catch (err: any) {
      setLoadError(err.message);
    }
  }, [fetcher]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const onSaved = (next: AdminRow[], message: string) => {
    setAdmins(next);
    setNotice(message);
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setAddError("");
    setNotice("");
    try {
      const email = newEmail.trim().toLowerCase();
      if (admins?.some((a) => a.email === email)) {
        throw new Error("This email already has access — change its ticks in the list below.");
      }
      if (newPassword && newPassword.length < 8) {
        throw new Error("Password must be at least 8 characters, or leave it blank for Microsoft SSO only.");
      }
      const res = await fetcher("/api/admin/admin-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          permissions: newPermissions,
          password: newPassword || undefined,
          aliases: parseAliasInput(newAliases),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not add this admin.");
      setAdmins(data.admins);
      setNotice(
        newPassword
          ? `${email} can now sign in with Microsoft SSO or password.`
          : `${email} can now sign in with Microsoft SSO (no password set).`,
      );
      setNewEmail("");
      setNewAliases("");
      setNewPassword("");
      setNewPermissions(NEW_ADMIN_DEFAULTS);
    } catch (err: any) {
      setAddError(err.message);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-background/95 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Admin panel access">
      <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-4">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-violet-600" />
          <div>
            <h2 className="text-base font-black text-foreground leading-none">Admin Panel Access</h2>
            <p className="text-[11px] text-muted-foreground mt-1">
              Use each person&apos;s exact Microsoft / Entra UPN. Add aliases if their mailbox and sign-in email differ. Password optional; ticks control what they see.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onClose} className="gap-1.5 text-xs">
          <X className="w-3.5 h-3.5" /> Close
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {superAdmin && (
            <p className="text-xs text-muted-foreground">
              <span className="font-bold text-foreground">{superAdmin}</span> is the main admin and always has full access.
              Tick <span className="font-semibold text-foreground">Portal Config</span> to let someone else manage this screen.
              Changes apply the next time each admin opens or refreshes the dashboard.
            </p>
          )}

          {notice && (
            <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 px-4 py-3 text-xs text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> {notice}
            </div>
          )}

          <form onSubmit={add} className="rounded-2xl border border-violet-200 dark:border-violet-900 bg-violet-50/40 dark:bg-violet-950/20 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-black text-foreground">
              <UserPlus className="w-4 h-4 text-violet-600" /> Give someone admin access
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="new-admin-email" className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  Microsoft / Entra email (exact UPN)
                </label>
                <input
                  id="new-admin-email"
                  type="email"
                  autoComplete="off"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="name@infinite.com"
                  className={inputClass}
                  required
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="new-admin-password" className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  Password (optional — leave blank for Microsoft SSO only)
                </label>
                <PasswordInput
                  id="new-admin-password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Optional backup password (min 8 chars)"
                  className={inputClass}
                  minLength={newPassword ? 8 : undefined}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label htmlFor="new-admin-aliases" className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                Entra aliases (optional)
              </label>
              <input
                id="new-admin-aliases"
                type="text"
                autoComplete="off"
                value={newAliases}
                onChange={(e) => setNewAliases(e.target.value)}
                placeholder="Other UPNs that should map to this account"
                className={inputClass}
              />
            </div>
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider pt-1">They can see</div>
            <PermissionTicks
              idPrefix="new-admin"
              value={newPermissions}
              onChange={(key, checked) => setNewPermissions((prev) => ({ ...prev, [key]: checked }))}
            />
            <div className="flex items-center gap-3 pt-1">
              <Button type="submit" size="sm" disabled={adding} className="h-10 px-5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-xs">
                {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Give access"}
              </Button>
              {addError && <span className="text-xs font-semibold text-red-600">{addError}</span>}
            </div>
          </form>

          <div className="space-y-3">
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
              Admins with access {admins ? `(${admins.length})` : ""}
            </div>
            {loadError ? (
              <div className="text-xs font-semibold text-red-600">{loadError}</div>
            ) : admins === null ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
              </div>
            ) : admins.length === 0 ? (
              <div className="text-xs text-muted-foreground">No other admins yet.</div>
            ) : (
              admins.map((admin) => <AdminCard key={admin.email} admin={admin} fetcher={fetcher} onSaved={onSaved} />)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
