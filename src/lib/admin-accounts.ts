/** What a named admin can be allowed to see; the super admin always has everything plus Portal Config. */
export const ADMIN_PERMISSIONS = [
  { key: "requirements", label: "Requirements (BR / JD) tab" },
  { key: "corpPool", label: "Corp Pool tab" },
  { key: "candidates", label: "Suitable & Non-Suitable Candidates tabs" },
  { key: "employeePortal", label: "Employee Portal tab (employee tests, scores, videos)" },
  { key: "emailOutbox", label: "Email Outbox tab" },
  { key: "allScreeningData", label: "Everyone's requirements, candidates and emails (untick = only their own)" },
  { key: "adminControls", label: "Admin Controls (ingestion, uploads, match scores, reset candidate)" },
  { key: "systemLogs", label: "System Logs viewer" },
  { key: "systemMonitor", label: "System Monitor" },
  { key: "portalConfig", label: "Portal Config (feature toggles & manage who has admin access)" },
  { key: "changePassword", label: "Change their own password" },
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number]["key"];
export type AdminPermissions = Record<AdminPermission, boolean>;

export function allPermissions(value: boolean): AdminPermissions {
  return Object.fromEntries(ADMIN_PERMISSIONS.map((p) => [p.key, value])) as AdminPermissions;
}

export type AdminAccess = {
  email: string;
  isSuperAdmin: boolean;
  permissions: AdminPermissions;
  canViewEmployeePortal: boolean;
  canChangePassword: boolean;
};

export type AdminAccessFlags = Omit<AdminAccess, "email">;

const ACCESS_KEY = "admin-access";

/** Reads the login / validate response; missing payload fails closed (no tabs). */
export function accessFlagsFromPayload(data: any): AdminAccessFlags {
  const hasPayload = data && typeof data === "object" && (data.permissions || data.isSuperAdmin === true || data.email);
  const permissions: AdminPermissions = {
    ...allPermissions(false),
    ...(hasPayload ? (data.permissions ?? {}) : {}),
  };
  if (data?.isSuperAdmin === true) {
    Object.assign(permissions, allPermissions(true), { changePassword: false });
  }
  if (data?.canViewEmployeePortal === false) permissions.employeePortal = false;
  if (data?.permissions) {
    permissions.changePassword = Boolean(permissions.changePassword);
  } else if (hasPayload) {
    permissions.changePassword = data?.canChangePassword === true;
  }
  return {
    isSuperAdmin: data?.isSuperAdmin === true,
    permissions,
    canViewEmployeePortal: permissions.employeePortal,
    canChangePassword: permissions.changePassword,
  };
}

export function storeAdminAccessFlags(access: AdminAccessFlags) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(ACCESS_KEY, JSON.stringify(access));
}

export function readAdminAccessFlags(): AdminAccessFlags {
  if (typeof window === "undefined") return accessFlagsFromPayload(null);
  try {
    const raw = window.sessionStorage.getItem(ACCESS_KEY);
    if (raw) return accessFlagsFromPayload(JSON.parse(raw));
  } catch {
    // fall through to deny-by-default
  }
  return accessFlagsFromPayload(null);
}

/** Fired when an admin API call returns 401, so the auth gate can ask for the password over the page. */
export const ADMIN_SESSION_EXPIRED_EVENT = "admin-session-expired";

export function clearAdminAccessFlags() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(ACCESS_KEY);
  window.sessionStorage.removeItem("admin-can-view-employee-portal");
  window.sessionStorage.removeItem("admin-can-change-password");
}
