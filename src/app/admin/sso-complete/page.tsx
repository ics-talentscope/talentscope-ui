"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { accessFlagsFromPayload, storeAdminAccessFlags } from "@/lib/admin-accounts";

export default function AdminSsoCompletePage() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/auth/saml/handoff", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.token || !data?.email) {
          throw new Error(data.error || "Microsoft sign-in did not complete.");
        }
        if (cancelled) return;
        window.sessionStorage.setItem("admin_token", data.token);
        window.sessionStorage.setItem("admin-email", data.email);
        window.sessionStorage.setItem("resume-admin-authenticated", "true");
        storeAdminAccessFlags(accessFlagsFromPayload(data));
        router.replace("/admin");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Microsoft sign-in failed.";
        if (!cancelled) {
          setError(message);
          router.replace(`/admin?sso_error=${encodeURIComponent(message)}`);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-200 text-sm font-medium">
      {error || "Finishing Microsoft sign-in…"}
    </div>
  );
}
