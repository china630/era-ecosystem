/** Finance/orchestrator roles that map to satellite BUSINESS_OWNER. */
export const FINANCE_OWNER_ROLES = ["OWNER", "DIRECTOR"] as const;

export const SATELLITE_ROLE = {
  BUSINESS_OWNER: "BUSINESS_OWNER",
  SATELLITE_OPERATOR: "SATELLITE_OPERATOR",
} as const;

export type SatelliteRoleCode =
  (typeof SATELLITE_ROLE)[keyof typeof SATELLITE_ROLE];

/**
 * Map control-plane membership role → satellite session role.
 * OWNER/DIRECTOR → BUSINESS_OWNER; others → SATELLITE_OPERATOR (read/ops).
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
