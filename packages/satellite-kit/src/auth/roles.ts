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

export function sessionHasRole(
  session: { role: string; roles?: string[] },
  required: string,
): boolean {
  if (session.role === required) return true;
  return session.roles?.includes(required) ?? false;
}
