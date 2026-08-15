import { isPlatformSuperAdminUser } from "./platform-super-admin";

/** Finance/orchestrator roles that map to satellite BUSINESS_OWNER. */
export const FINANCE_OWNER_ROLES = ["OWNER", "DIRECTOR"] as const;

/** Roles that may SSO into satellites and use Finance in parallel. */
export const FINANCE_CROSS_SYSTEM_ROLES = [
  "OWNER",
  "DIRECTOR",
  "ADMIN",
  "ACCOUNTANT",
] as const;

export const SATELLITE_ROLE = {
  BUSINESS_OWNER: "BUSINESS_OWNER",
  /** ADMIN/ACCOUNTANT from Orch — exec read-only, not billing owner. */
  PLATFORM_MEMBER: "PLATFORM_MEMBER",
  SATELLITE_OPERATOR: "SATELLITE_OPERATOR",
} as const;

export type SatelliteRoleCode =
  (typeof SATELLITE_ROLE)[keyof typeof SATELLITE_ROLE];

/**
 * Map control-plane membership role → satellite session role.
 * OWNER/DIRECTOR → BUSINESS_OWNER; ADMIN/ACCOUNTANT → PLATFORM_MEMBER; else SATELLITE_OPERATOR.
 */
export function mapFinanceRoleToSatellite(
  financeRole: string | null | undefined,
): SatelliteRoleCode {
  if (!financeRole) return SATELLITE_ROLE.SATELLITE_OPERATOR;
  const upper = financeRole.toUpperCase();
  if (
    FINANCE_OWNER_ROLES.includes(
      upper as (typeof FINANCE_OWNER_ROLES)[number],
    )
  ) {
    return SATELLITE_ROLE.BUSINESS_OWNER;
  }
  if (
    FINANCE_CROSS_SYSTEM_ROLES.includes(
      upper as (typeof FINANCE_CROSS_SYSTEM_ROLES)[number],
    )
  ) {
    return SATELLITE_ROLE.PLATFORM_MEMBER;
  }
  return SATELLITE_ROLE.SATELLITE_OPERATOR;
}

export function isBusinessOwnerRole(role: string): boolean {
  return role === SATELLITE_ROLE.BUSINESS_OWNER;
}

/**
 * Platform super-admin gate shared by every satellite: identified by the
 * allowlist (`PLATFORM_SUPER_ADMIN_EMAILS`). Matches by email or login so it
 * works for both SSO (`email`) and local (`login`) sessions.
 */
export function sessionIsPlatformSuperAdmin(session: {
  login?: string | null;
  email?: string | null;
}): boolean {
  if (!session.login && !session.email) return false;
  return isPlatformSuperAdminUser({
    login: session.login ?? "",
    email: session.email ?? null,
  });
}

export function sessionHasRole(
  session: {
    role: string;
    roles?: string[];
    login?: string | null;
    email?: string | null;
  },
  required: string,
): boolean {
  if (session.role === required) return true;
  if (session.roles?.includes(required)) return true;
  // Platform super-admins satisfy every satellite role.
  return sessionIsPlatformSuperAdmin(session);
}
