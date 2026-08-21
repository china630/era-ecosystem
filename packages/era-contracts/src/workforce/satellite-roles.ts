import { z } from "zod";

export const SATELLITE_KEY_CLINIC = "industry_clinic" as const;
export const SATELLITE_KEY_HOTEL = "industry_hotel_pms" as const;
export const SATELLITE_KEY_FNB = "industry_fnb_pos" as const;

export const clinicSatelliteRoleSchema = z.enum([
  "DOCTOR",
  "NURSE",
  "RECEPTION",
  "CLINIC_ADMIN",
  "FLOOR",
]);

export const hotelSatelliteRoleSchema = z.enum([
  "RECEPTION",
  "HOUSEKEEPING",
  "MANAGER",
  "STAFF",
]);

export const fnbSatelliteRoleSchema = z.enum([
  "WAITER",
  "MANAGER",
  "CHEF",
  "CASHIER",
  "STAFF",
]);

export type ClinicSatelliteRole = z.infer<typeof clinicSatelliteRoleSchema>;
export type HotelSatelliteRole = z.infer<typeof hotelSatelliteRoleSchema>;
export type FnbSatelliteRole = z.infer<typeof fnbSatelliteRoleSchema>;

const ROLES_BY_SATELLITE: Record<string, readonly string[]> = {
  [SATELLITE_KEY_CLINIC]: clinicSatelliteRoleSchema.options,
  [SATELLITE_KEY_HOTEL]: hotelSatelliteRoleSchema.options,
  [SATELLITE_KEY_FNB]: fnbSatelliteRoleSchema.options,
};

const DEFAULT_ROLE_BY_SATELLITE: Record<string, string> = {
  [SATELLITE_KEY_CLINIC]: "RECEPTION",
  [SATELLITE_KEY_HOTEL]: "STAFF",
  [SATELLITE_KEY_FNB]: "STAFF",
};

/** Nafta default position name → satellite role hints for seed scripts. */
export const NAFTA_POSITION_ROLE_SEED: Array<{
  positionNamePattern: string;
  satelliteKey: string;
  satelliteRole: string;
}> = [
  { positionNamePattern: "therapist", satelliteKey: SATELLITE_KEY_CLINIC, satelliteRole: "DOCTOR" },
  { positionNamePattern: "doctor", satelliteKey: SATELLITE_KEY_CLINIC, satelliteRole: "DOCTOR" },
  { positionNamePattern: "врач", satelliteKey: SATELLITE_KEY_CLINIC, satelliteRole: "DOCTOR" },
  { positionNamePattern: "waiter", satelliteKey: SATELLITE_KEY_FNB, satelliteRole: "WAITER" },
  { positionNamePattern: "reception", satelliteKey: SATELLITE_KEY_HOTEL, satelliteRole: "RECEPTION" },
];

export function operationalRolesForSatellite(
  satelliteKey?: string | null,
): readonly string[] {
  if (!satelliteKey?.trim()) return fnbSatelliteRoleSchema.options;
  return ROLES_BY_SATELLITE[satelliteKey] ?? fnbSatelliteRoleSchema.options;
}

export function defaultRoleForSatellite(satelliteKey: string): string {
  return DEFAULT_ROLE_BY_SATELLITE[satelliteKey] ?? "STAFF";
}

export function isValidSatelliteRole(satelliteKey: string, role: string): boolean {
  const allowed = ROLES_BY_SATELLITE[satelliteKey];
  if (!allowed) return role.trim().length > 0;
  return allowed.includes(role.toUpperCase());
}

export function normalizeSatelliteRole(satelliteKey: string, role: string): string {
  const upper = role.trim().toUpperCase();
  if (isValidSatelliteRole(satelliteKey, upper)) return upper;
  return defaultRoleForSatellite(satelliteKey);
}
