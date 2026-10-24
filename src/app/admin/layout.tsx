"use client";

import { usePathname } from "next/navigation";
import AdminAuthGate from "@/components/AdminAuthGate";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  // SSO handoff must render without the login gate (same pattern as employee).
  if (pathname.startsWith("/admin/sso-complete")) {
    return <>{children}</>;
  }
  return <AdminAuthGate>{children}</AdminAuthGate>;
}
