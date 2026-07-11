import { CLINIC_ROLE, sessionHasClinicRole } from "@/lib/clinic-roles";

/** Minimal session shape for admin gates (edge-safe — no @era/satellite-kit barrel). */
export type ClinicAdminSession = {
  role: string;
  roles?: string[];
  isOwner?: boolean;
  login: string;
  email?: string;
};

const DEFAULT_PLATFORM_SUPER_ADMIN_EMAILS = [
  "inaram84@gmail.com",
  "shirinov.chingiz@gmail.com",
  "chingiz@era.com",
] as const;

/**
 * Edge-safe allowlist check — must not import `@era/satellite-kit` (Node crypto).
 * Keep in sync with `packages/satellite-kit/src/auth/platform-super-admin.ts`.
 */
function isPlatformSuperAdminEdge(user: {
  email?: string | null;
  login: string;
}): boolean {
  const raw = process.env.PLATFORM_SUPER_ADMIN_EMAILS?.trim();
  const allowed = raw
    ? [
        ...new Set(
          raw
            .split(/[,;\s]+/)
            .map((e) => e.trim().toLowerCase())
            .filter((e) => e.includes("@")),
        ),
      ]
    : [...DEFAULT_PLATFORM_SUPER_ADMIN_EMAILS];
  const list = allowed.length > 0 ? allowed : [...DEFAULT_PLATFORM_SUPER_ADMIN_EMAILS];
  const email = user.email?.trim().toLowerCase();
  if (email && list.includes(email)) return true;
  return list.includes(user.login.trim().toLowerCase());
}

/** Roles that may use `/admin/*` and admin APIs (SatAdmin actor). */
export function hasClinicAdminAccess(session: ClinicAdminSession): boolean {
  if (session.isOwner === true) return true;
  if (session.role === "BUSINESS_OWNER") return true;
  if (session.roles?.includes("BUSINESS_OWNER")) return true;
  if (sessionHasClinicRole(session.role, [CLINIC_ROLE.CLINIC_ADMIN])) return true;
  if (session.roles?.includes(CLINIC_ROLE.CLINIC_ADMIN)) return true;
  /** Legacy bootstrap role before CLINIC_ADMIN rename. */
  if (session.role === "ADMIN") return true;
  return isPlatformSuperAdminEdge({
    email: session.email,
    login: session.login,
  });
}
