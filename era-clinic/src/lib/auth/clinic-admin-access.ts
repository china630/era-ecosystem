import { CLINIC_ROLE, sessionHasClinicRole } from "@/lib/clinic-roles";
import { isPlatformSuperAdminUser } from "@/lib/auth/platform-super-admin";

/** Minimal session shape for admin gates (edge-safe — no @era/satellite-kit barrel). */
export type ClinicAdminSession = {
  role: string;
  roles?: string[];
  isOwner?: boolean;
  login: string;
  email?: string;
};

/** Roles that may use `/admin/*` and admin APIs (SatAdmin actor). */
export function hasClinicAdminAccess(session: ClinicAdminSession): boolean {
  if (session.isOwner === true) return true;
  if (session.role === "BUSINESS_OWNER") return true;
  if (session.roles?.includes("BUSINESS_OWNER")) return true;
  if (sessionHasClinicRole(session.role, [CLINIC_ROLE.CLINIC_ADMIN])) return true;
  if (session.roles?.includes(CLINIC_ROLE.CLINIC_ADMIN)) return true;
  /** Legacy bootstrap role before CLINIC_ADMIN rename. */
  if (session.role === "ADMIN") return true;
  return isPlatformSuperAdminUser({
    email: session.email,
    login: session.login,
  });
}
