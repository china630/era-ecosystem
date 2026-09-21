/** Seeded system role codes — template matrix lives in clinic-permissions defaults. */
export const CLINIC_ROLE = {
  CLINIC_ADMIN: "CLINIC_ADMIN",
  RECEPTION: "RECEPTION",
  DOCTOR: "DOCTOR",
  NURSE: "NURSE",
  FLOOR: "FLOOR",
  LAB_TECH: "LAB_TECH",
} as const;

export type ClinicRoleCode = (typeof CLINIC_ROLE)[keyof typeof CLINIC_ROLE];

/** System roles created by ensureSystemClinicRoles — not deletable. */
export const SYSTEM_CLINIC_ROLES: ClinicRoleCode[] = [
  CLINIC_ROLE.RECEPTION,
  CLINIC_ROLE.DOCTOR,
  CLINIC_ROLE.NURSE,
  CLINIC_ROLE.FLOOR,
  CLINIC_ROLE.LAB_TECH,
  CLINIC_ROLE.CLINIC_ADMIN,
];

/** @deprecated Use SYSTEM_CLINIC_ROLES — kept for scripts/tests mid-migration. */
export const CONFIGURABLE_CLINIC_ROLES = SYSTEM_CLINIC_ROLES;

/** Practitioner persona on Role.staffKind (not used for screen/API gates). */
export type ClinicRoleStaffKind = "DOCTOR" | "NURSE" | "LAB" | "NONE";

export const SYSTEM_ROLE_STAFF_KIND: Record<ClinicRoleCode, ClinicRoleStaffKind> =
  {
    [CLINIC_ROLE.RECEPTION]: "NONE",
    [CLINIC_ROLE.DOCTOR]: "DOCTOR",
    [CLINIC_ROLE.NURSE]: "NURSE",
    [CLINIC_ROLE.FLOOR]: "NURSE",
    [CLINIC_ROLE.LAB_TECH]: "LAB",
    [CLINIC_ROLE.CLINIC_ADMIN]: "NONE",
  };

export const SYSTEM_ROLE_NAMES: Record<ClinicRoleCode, string> = {
  [CLINIC_ROLE.RECEPTION]: "Reception",
  [CLINIC_ROLE.DOCTOR]: "Doctor",
  [CLINIC_ROLE.NURSE]: "Nurse",
  [CLINIC_ROLE.FLOOR]: "Floor check-in",
  [CLINIC_ROLE.LAB_TECH]: "Lab technician",
  [CLINIC_ROLE.CLINIC_ADMIN]: "Clinic administrator",
};

/**
 * CP / legacy aliases → system role codes only.
 * Custom roles (e.g. CHIEF_DOCTOR) are not aliased — must exist as Role rows.
 */
export const SYSTEM_ROLE_ALIASES: Record<string, ClinicRoleCode> = {
  DOCTOR: CLINIC_ROLE.DOCTOR,
  NURSE: CLINIC_ROLE.NURSE,
  FLOOR: CLINIC_ROLE.FLOOR,
  LAB_TECH: CLINIC_ROLE.LAB_TECH,
  LAB: CLINIC_ROLE.LAB_TECH,
  CLINIC_ADMIN: CLINIC_ROLE.CLINIC_ADMIN,
  RECEPTION: CLINIC_ROLE.RECEPTION,
  ADMIN: CLINIC_ROLE.CLINIC_ADMIN,
  STAFF: CLINIC_ROLE.RECEPTION,
};

export function isSystemClinicRoleCode(code: string): code is ClinicRoleCode {
  return (SYSTEM_CLINIC_ROLES as readonly string[]).includes(code);
}

export function resolveSystemRoleAlias(raw: string): string {
  const upper = raw.trim().toUpperCase();
  return SYSTEM_ROLE_ALIASES[upper] ?? upper;
}

export function parseClinicRoleStaffKind(
  value: string | null | undefined,
): ClinicRoleStaffKind {
  if (value === "DOCTOR" || value === "NURSE" || value === "LAB" || value === "NONE") {
    return value;
  }
  return "NONE";
}

export function sessionHasClinicRole(
  role: string | undefined,
  allowed: ClinicRoleCode[],
): boolean {
  if (!role) return false;
  return allowed.includes(role as ClinicRoleCode);
}
