import { isPlatformSuperAdminEdge } from "@/lib/auth/platform-super-admin-edge";

/** Minimal session shape for admin gates (edge-safe — no @era/satellite-kit barrel). */
export type ClinicAdminSession = {
  role: string;
  roles?: string[];
  isOwner?: boolean;
  login: string;
  email?: string;
};

/**
 * OrgOwner / platform super-admin bypass for permission matrix.
 * CLINIC_ADMIN does NOT bypass — matrix applies.
 */
export function hasClinicPermissionBypass(session: ClinicAdminSession): boolean {
  if (session.isOwner === true) return true;
  if (session.role === "BUSINESS_OWNER") return true;
  if (session.roles?.includes("BUSINESS_OWNER")) return true;
  return isPlatformSuperAdminEdge({
    email: session.email,
    login: session.login,
  });
}

/**
 * @deprecated Prefer permission keys + hasClinicPermissionBypass.
 * Kept for OrgOwner / legacy detection only — do not use to gate screens/APIs.
 */
export function hasClinicAdminAccess(session: ClinicAdminSession): boolean {
  return hasClinicPermissionBypass(session);
}
