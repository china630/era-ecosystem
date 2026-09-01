import { CLINIC_ROLE, sessionHasClinicRole } from "@/lib/clinic-roles";
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
 * Historical SatAdmin actor check (role code / owner / super-admin).
 * Prefer permission keys for enforcement; use this for documentation / OrgOwner detection only.
 */
export function hasClinicAdminAccess(session: ClinicAdminSession): boolean {
  if (hasClinicPermissionBypass(session)) return true;
  if (sessionHasClinicRole(session.role, [CLINIC_ROLE.CLINIC_ADMIN])) return true;
  if (session.roles?.includes(CLINIC_ROLE.CLINIC_ADMIN)) return true;
  /** Legacy bootstrap role before CLINIC_ADMIN rename. */
  if (session.role === "ADMIN") return true;
  return false;
}
