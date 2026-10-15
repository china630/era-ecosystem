/**
 * System role on a hotel revenue code: the stable key services post and
 * classify by. Code number and name stay free for the hotel to edit.
 * Add a role only together with the code path that looks it up.
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
  'TOUR',
  'BANQUET',
  'FOOD',
  'MEDICAL',
  'DISCOUNT',
  'CITY_TAX',
] as const;

export type RevenueCodeRole = (typeof REVENUE_CODE_ROLES)[number];

/** Nightly stay charges: the room night itself, the package night, and re-rates. */
export const STAY_NIGHT_ROLES: readonly RevenueCodeRole[] = ['ROOM', 'PKG', 'RATE_ADJ'];

/** Everything a package night is made of — refunded together on early checkout. */
export const LODGING_ROLES: readonly RevenueCodeRole[] = ['ROOM', 'PKG', 'TREATMENT', 'BOARD'];

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
