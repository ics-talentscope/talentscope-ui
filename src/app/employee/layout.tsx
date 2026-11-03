"use client";

import { usePathname } from "next/navigation";
import EmployeeAuthGate from "@/components/EmployeeAuthGate";

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublicRoute =
    pathname === "/employee" ||
    pathname.startsWith("/employee/set-password") ||
    pathname.startsWith("/employee/sso-complete");

  return (
    <div className="employee-portal-green min-h-screen">
      {isPublicRoute ? children : <EmployeeAuthGate>{children}</EmployeeAuthGate>}
    </div>
  );
}
