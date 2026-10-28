/**
 * System role on a hotel revenue code: the stable key services post and
 * classify by. Code number and name stay free for the hotel to edit.
 * Add a role only together with the code path that looks it up.
 *
 * BOARD / TELECOM / RESORT_FEE stay in the platform list for leisure templates;
 * Nafta does not activate those codes on the guest folio.
 */
export const REVENUE_CODE_ROLES = [
  'ROOM',
  'BOARD',
  'PKG',
  'TREATMENT',
  'RATE_ADJ',
  'EARLY_CI',
  'LATE_CO',
  'MINIBAR',
  'LAUNDRY',
  'TRANSFER',
  'TAXI',
  'TOUR',
  'BANQUET',
  'SPA',
  'PARKING',
  'CXL_NOSHOW',
  'DAMAGE',
  'OTHER',
  'TELECOM',
  'RESORT_FEE',
  'FOOD',
  'BEVERAGE',
  'ALCOHOL',
  'TOBACCO',
  'HALL',
  'ENTERTAINMENT',
  'FB_DISCOUNT',
  'PROCEDURE',
  'DOCTOR',
  'DIAGNOSTIC',
  'LAB',
  'PHARMA',
  'CLINIC_DISCOUNT',
  /** @deprecated Prefer PROCEDURE. Kept for remap alias only. */
  'MEDICAL',
  'DISCOUNT',
  'CITY_TAX',
] as const;

export type RevenueCodeRole = (typeof REVENUE_CODE_ROLES)[number];

/** Nightly stay charges: room night, package night, re-rates. */
export const STAY_NIGHT_ROLES: readonly RevenueCodeRole[] = ['ROOM', 'PKG', 'RATE_ADJ'];

/**
 * Lodging roles for early-checkout / unused-nights and lodging payment allocate.
 * BOARD only when a property activates a BOARD code (not Nafta folio).
 */
export const LODGING_ROLES: readonly RevenueCodeRole[] = ['ROOM', 'PKG', 'RATE_ADJ', 'BOARD'];

/** Roles treated as lodging for Extra payment (no guest pocket pick). */
export const LODGING_PAYMENT_ROLES: readonly RevenueCodeRole[] = ['ROOM', 'PKG', 'RATE_ADJ', 'CITY_TAX'];

export function isRevenueCodeRole(value: unknown): value is RevenueCodeRole {
  return typeof value === 'string' && (REVENUE_CODE_ROLES as readonly string[]).includes(value);
}

/** `systemRole` is required on the type so a select that forgets it fails to compile. */
type RoleRow = { systemRole: string | null } | null | undefined;

export function revenueRoleIs(row: RoleRow, role: RevenueCodeRole): boolean {
  return (row?.systemRole ?? null) === role;
}

export function revenueRoleIn(
  row: RoleRow,
  roles: readonly RevenueCodeRole[],
): boolean {
  const role = row?.systemRole ?? null;
  return role != null && (roles as readonly string[]).includes(role);
}

/** Resolve deprecated MEDICAL → PROCEDURE for lookups. */
export function normalizeRevenueRole(role: string | null | undefined): string | null {
  if (!role) return null;
  if (role === 'MEDICAL') return 'PROCEDURE';
  if (role === 'TREATMENT') return 'PKG';
  return role;
}
