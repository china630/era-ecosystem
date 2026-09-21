/** Seeded system role codes — template matrix lives in ROLE_PERMISSIONS. */
import { ROLE_CODES, type RoleCode } from "@/lib/auth/permissions";

export const SYSTEM_HOTEL_ROLES: RoleCode[] = [
  ROLE_CODES.HOTEL_ADMIN,
  ROLE_CODES.MANAGER,
  ROLE_CODES.RECEPTIONIST,
  ROLE_CODES.NIGHT_AUDITOR,
  ROLE_CODES.HOUSEKEEPER,
  ROLE_CODES.DOCTOR,
  ROLE_CODES.CRM,
  ROLE_CODES.FINANCIAL_AUDITOR,
];

export const SYSTEM_ROLE_NAMES: Record<RoleCode, string> = {
  [ROLE_CODES.HOTEL_ADMIN]: "Hotel Admin",
  [ROLE_CODES.MANAGER]: "Manager",
  [ROLE_CODES.RECEPTIONIST]: "Receptionist",
  [ROLE_CODES.NIGHT_AUDITOR]: "Night Auditor",
  [ROLE_CODES.HOUSEKEEPER]: "Housekeeper",
  [ROLE_CODES.DOCTOR]: "Doctor",
  [ROLE_CODES.CRM]: "CRM",
  [ROLE_CODES.FINANCIAL_AUDITOR]: "Financial Auditor",
};

/**
 * CP / legacy aliases → system role codes only.
 * Custom roles are not aliased — must exist as Role rows.
 */
export const SYSTEM_ROLE_ALIASES: Record<string, RoleCode> = {
  RECEPTION: ROLE_CODES.RECEPTIONIST,
  RECEPTIONIST: ROLE_CODES.RECEPTIONIST,
  HOUSEKEEPING: ROLE_CODES.HOUSEKEEPER,
  HOUSEKEEPER: ROLE_CODES.HOUSEKEEPER,
  MANAGER: ROLE_CODES.MANAGER,
  STAFF: ROLE_CODES.RECEPTIONIST,
  HOTEL_ADMIN: ROLE_CODES.HOTEL_ADMIN,
  ADMIN: ROLE_CODES.HOTEL_ADMIN,
  NIGHT_AUDITOR: ROLE_CODES.NIGHT_AUDITOR,
  NIGHTAUDITOR: ROLE_CODES.NIGHT_AUDITOR,
  DOCTOR: ROLE_CODES.DOCTOR,
  CRM: ROLE_CODES.CRM,
  FINANCIAL_AUDITOR: ROLE_CODES.FINANCIAL_AUDITOR,
  FINANCIALAUDITOR: ROLE_CODES.FINANCIAL_AUDITOR,
};

export function isSystemHotelRoleCode(code: string): code is RoleCode {
  if ((SYSTEM_HOTEL_ROLES as readonly string[]).includes(code)) return true;
  const upper = code.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (SYSTEM_ROLE_ALIASES[upper]) return true;
  return SYSTEM_HOTEL_ROLES.some(
    (c) => c.toUpperCase().replace(/[\s-]+/g, "_") === upper,
  );
}

/**
 * Resolve CP alias → system code; custom codes normalize to UPPER_SNAKE.
 * System display codes like `Receptionist` / `Hotel_Admin` are preserved.
 */
export function resolveSystemRoleAlias(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  const upper = trimmed.toUpperCase().replace(/[\s-]+/g, "_");
  if (SYSTEM_ROLE_ALIASES[upper]) return SYSTEM_ROLE_ALIASES[upper];
  const systemExact = SYSTEM_HOTEL_ROLES.find(
    (c) => c === trimmed || c.toUpperCase().replace(/[\s-]+/g, "_") === upper,
  );
  if (systemExact) return systemExact;
  return upper;
}
