/** Satellite operational role codes for HR provisioning UI and explicit overrides. */
export const SATELLITE_OPERATIONAL_ROLES = [
  "WAITER",
  "MANAGER",
  "RECEPTION",
  "HOUSEKEEPING",
  "CHEF",
  "CASHIER",
  "STAFF",
] as const;

export type SatelliteOperationalRole = (typeof SATELLITE_OPERATIONAL_ROLES)[number];

/** Finance JobPosition name/code → satellite operational role code. */
const POSITION_ROLE_MAP: Record<string, string> = {
  waiter: "WAITER",
  "официант": "WAITER",
  manager: "MANAGER",
  "менеджер": "MANAGER",
  receptionist: "RECEPTION",
  reception: "RECEPTION",
  housekeeping: "HOUSEKEEPING",
  chef: "CHEF",
  cashier: "CASHIER",
};

export function mapFinancePositionToSatelliteRole(
  positionName: string,
  explicitRole?: string | null,
): string {
  if (explicitRole?.trim()) return explicitRole.trim().toUpperCase();
  const key = positionName.trim().toLowerCase();
  for (const [pattern, role] of Object.entries(POSITION_ROLE_MAP)) {
    if (key.includes(pattern)) return role;
  }
  return "STAFF";
}
