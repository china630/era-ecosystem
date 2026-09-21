import {
  normalizeHotelPermission,
  remapPermissionList,
  withPairedScreens,
} from "@/lib/auth/hotel-permission-rename";

/** Fleet-canon keys (Wave 2). TS identifiers unchanged; values use api: / admin: prefixes. */
export const PERMISSIONS = {
  RESERVATIONS_READ: "api:reservations.read",
  RESERVATIONS_WRITE: "api:reservations.write",
  RESERVATIONS_CHECKIN: "api:reservations.checkin",
  RESERVATIONS_CHECKOUT: "api:reservations.checkout",
  RESERVATIONS_CANCEL: "api:reservations.cancel",
  FOLIO_READ: "api:folio.read",
  FOLIO_CHARGE: "api:folio.charge",
  FOLIO_PAYMENT: "api:folio.payment",
  FOLIO_VOID: "api:folio.void",
  ROOMS_STATUS: "api:rooms.status",
  HOUSEKEEPING_MANAGE: "api:housekeeping.manage",
  MEDICAL_MANAGE: "api:medical.manage",
  CHANNEL_MANAGE: "api:channel.manage",
  NIGHT_AUDIT_RUN: "api:night_audit.run",
  MASTER_DATA_MANAGE: "admin:master_data",
  USERS_MANAGE: "admin:users",
  /** Role matrix UI + role CRUD — default Hotel_Admin only. */
  ACCESS_MANAGE: "admin:access_manage",
  REPORTS_READ: "api:reports.read",
  CASH_SHIFT: "api:cash.shift",
  /** Elektraweb bulk import UI/API — grant ∩ hotel_migration_pro SKU. */
  API_IMPORT_ELEKTRAWEB: "api:import.elektraweb",
  /** Elektraweb bridge staff session — grant ∩ policy/env. */
  API_INTEGRATION_ELEKTRAWEB_BRIDGE: "api:integration.elektraweb_bridge",
  SCREEN_HOME: "screen:home",
  SCREEN_FO: "screen:fo",
  SCREEN_HK: "screen:hk",
  SCREEN_MEDICAL: "screen:medical",
  SCREEN_DISTRIBUTION: "screen:distribution",
  SCREEN_NIGHT_AUDIT: "screen:night_audit",
  SCREEN_FRONT_CASH: "screen:front_cash",
  SCREEN_REPORTS: "screen:reports",
  SCREEN_FOLIO: "screen:folio",
  SCREEN_TOURS: "screen:tours",
  SCREEN_ADMIN: "screen:admin",
  SCREEN_SETTINGS: "screen:settings",
  SCREEN_SETTINGS_USERS: "screen:settings.users",
  SCREEN_SETTINGS_ACCESS: "screen:settings.access",
  SCREEN_SETTINGS_IMPORT: "screen:settings.import",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLE_CODES = {
  HOTEL_ADMIN: "Hotel_Admin",
  MANAGER: "Manager",
  RECEPTIONIST: "Receptionist",
  NIGHT_AUDITOR: "NightAuditor",
  HOUSEKEEPER: "Housekeeper",
  DOCTOR: "Doctor",
  CRM: "CRM",
  FINANCIAL_AUDITOR: "Financial_Auditor",
} as const;

export type RoleCode = (typeof ROLE_CODES)[keyof typeof ROLE_CODES];

export const ALL_PERMISSIONS = Object.values(PERMISSIONS);

export type PermissionGroup = {
  id: string;
  labelKey: string;
  permissions: Permission[];
};

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: "screens",
    labelKey: "groupScreens",
    permissions: [
      PERMISSIONS.SCREEN_HOME,
      PERMISSIONS.SCREEN_FO,
      PERMISSIONS.SCREEN_FOLIO,
      PERMISSIONS.SCREEN_FRONT_CASH,
      PERMISSIONS.SCREEN_HK,
      PERMISSIONS.SCREEN_MEDICAL,
      PERMISSIONS.SCREEN_DISTRIBUTION,
      PERMISSIONS.SCREEN_NIGHT_AUDIT,
      PERMISSIONS.SCREEN_REPORTS,
      PERMISSIONS.SCREEN_TOURS,
      PERMISSIONS.SCREEN_ADMIN,
      PERMISSIONS.SCREEN_SETTINGS,
      PERMISSIONS.SCREEN_SETTINGS_USERS,
      PERMISSIONS.SCREEN_SETTINGS_ACCESS,
      PERMISSIONS.SCREEN_SETTINGS_IMPORT,
    ],
  },
  {
    id: "fo",
    labelKey: "groupFo",
    permissions: [
      PERMISSIONS.RESERVATIONS_READ,
      PERMISSIONS.RESERVATIONS_WRITE,
      PERMISSIONS.RESERVATIONS_CHECKIN,
      PERMISSIONS.RESERVATIONS_CHECKOUT,
      PERMISSIONS.RESERVATIONS_CANCEL,
      PERMISSIONS.ROOMS_STATUS,
      PERMISSIONS.CASH_SHIFT,
    ],
  },
  {
    id: "folio",
    labelKey: "groupFolio",
    permissions: [
      PERMISSIONS.FOLIO_READ,
      PERMISSIONS.FOLIO_CHARGE,
      PERMISSIONS.FOLIO_PAYMENT,
      PERMISSIONS.FOLIO_VOID,
    ],
  },
  {
    id: "hk",
    labelKey: "groupHk",
    permissions: [PERMISSIONS.HOUSEKEEPING_MANAGE, PERMISSIONS.ROOMS_STATUS],
  },
  {
    id: "channel",
    labelKey: "groupChannel",
    permissions: [PERMISSIONS.CHANNEL_MANAGE],
  },
  {
    id: "medical",
    labelKey: "groupMedical",
    permissions: [PERMISSIONS.MEDICAL_MANAGE],
  },
  {
    id: "reports",
    labelKey: "groupReports",
    permissions: [PERMISSIONS.REPORTS_READ, PERMISSIONS.NIGHT_AUDIT_RUN],
  },
  {
    id: "admin",
    labelKey: "groupAdmin",
    permissions: [
      PERMISSIONS.MASTER_DATA_MANAGE,
      PERMISSIONS.USERS_MANAGE,
      PERMISSIONS.ACCESS_MANAGE,
    ],
  },
  {
    id: "migration",
    labelKey: "groupMigration",
    permissions: [
      PERMISSIONS.API_IMPORT_ELEKTRAWEB,
      PERMISSIONS.API_INTEGRATION_ELEKTRAWEB_BRIDGE,
    ],
  },
];

export const ROLE_PERMISSIONS: Record<RoleCode, Permission[]> = {
  [ROLE_CODES.HOTEL_ADMIN]: [...ALL_PERMISSIONS],
  [ROLE_CODES.MANAGER]: withPairedScreens([
    PERMISSIONS.RESERVATIONS_READ,
    PERMISSIONS.RESERVATIONS_WRITE,
    PERMISSIONS.RESERVATIONS_CHECKIN,
    PERMISSIONS.RESERVATIONS_CHECKOUT,
    PERMISSIONS.RESERVATIONS_CANCEL,
    PERMISSIONS.FOLIO_READ,
    PERMISSIONS.FOLIO_CHARGE,
    PERMISSIONS.FOLIO_PAYMENT,
    PERMISSIONS.FOLIO_VOID,
    PERMISSIONS.ROOMS_STATUS,
    PERMISSIONS.HOUSEKEEPING_MANAGE,
    PERMISSIONS.MEDICAL_MANAGE,
    PERMISSIONS.CHANNEL_MANAGE,
    PERMISSIONS.NIGHT_AUDIT_RUN,
    PERMISSIONS.MASTER_DATA_MANAGE,
    PERMISSIONS.CASH_SHIFT,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.API_IMPORT_ELEKTRAWEB,
    PERMISSIONS.API_INTEGRATION_ELEKTRAWEB_BRIDGE,
  ]) as Permission[],
  [ROLE_CODES.RECEPTIONIST]: withPairedScreens([
    PERMISSIONS.RESERVATIONS_READ,
    PERMISSIONS.RESERVATIONS_WRITE,
    PERMISSIONS.RESERVATIONS_CHECKIN,
    PERMISSIONS.RESERVATIONS_CHECKOUT,
    PERMISSIONS.FOLIO_READ,
    PERMISSIONS.FOLIO_CHARGE,
    PERMISSIONS.FOLIO_PAYMENT,
    PERMISSIONS.ROOMS_STATUS,
    PERMISSIONS.CASH_SHIFT,
    PERMISSIONS.API_INTEGRATION_ELEKTRAWEB_BRIDGE,
  ]) as Permission[],
  [ROLE_CODES.NIGHT_AUDITOR]: withPairedScreens([
    PERMISSIONS.RESERVATIONS_READ,
    PERMISSIONS.RESERVATIONS_CHECKIN,
    PERMISSIONS.RESERVATIONS_CHECKOUT,
    PERMISSIONS.RESERVATIONS_CANCEL,
    PERMISSIONS.FOLIO_READ,
    PERMISSIONS.NIGHT_AUDIT_RUN,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.CASH_SHIFT,
    PERMISSIONS.API_INTEGRATION_ELEKTRAWEB_BRIDGE,
  ]) as Permission[],
  [ROLE_CODES.HOUSEKEEPER]: withPairedScreens([
    PERMISSIONS.ROOMS_STATUS,
    PERMISSIONS.HOUSEKEEPING_MANAGE,
  ]) as Permission[],
  [ROLE_CODES.DOCTOR]: withPairedScreens([
    PERMISSIONS.MEDICAL_MANAGE,
    PERMISSIONS.FOLIO_READ,
    PERMISSIONS.RESERVATIONS_READ,
  ]) as Permission[],
  [ROLE_CODES.CRM]: withPairedScreens([
    PERMISSIONS.RESERVATIONS_READ,
    PERMISSIONS.CHANNEL_MANAGE,
    PERMISSIONS.FOLIO_READ,
  ]) as Permission[],
  [ROLE_CODES.FINANCIAL_AUDITOR]: withPairedScreens([
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.FOLIO_READ,
    PERMISSIONS.RESERVATIONS_READ,
    PERMISSIONS.CASH_SHIFT,
  ]) as Permission[],
};

export function permissionsForRole(roleCode: string): Permission[] {
  return ROLE_PERMISSIONS[roleCode as RoleCode] ?? [];
}

/** @deprecated Prefer session/DB grants — role name alone must not grant rights. */
export function hasPermission(roleCode: string, permission: Permission): boolean {
  return permissionsForRole(roleCode).includes(permission);
}

/** Persist canonical keys only. */
export function serializePermissions(perms: Permission[]): string {
  return JSON.stringify(remapPermissionList(perms) as Permission[]);
}

/** Accepts only fleet-canon strings (after Wave 2 cutover). */
export function isHotelPermission(value: string): value is Permission {
  return (ALL_PERMISSIONS as string[]).includes(value);
}

/**
 * Parse stored JSON. Dual-read: legacy aliases → canonical; unknowns dropped.
 * Writes must use serializePermissions / isHotelPermission (canonical only).
 */
export function parsePermissions(json: string): Permission[] {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return remapPermissionList(parsed.map(String)) as Permission[];
  } catch {
    return [];
  }
}

/** Dual-read a single JWT/session claim string. */
export function coerceHotelPermission(raw: string): Permission | null {
  const n = normalizeHotelPermission(raw);
  return n && isHotelPermission(n) ? n : null;
}

/** Valid JSON array (incl. empty) is authoritative; invalid/missing → role template. */
export function effectiveRolePermissions(
  roleCode: string,
  permissionsJson: string,
): Permission[] {
  try {
    const parsed = JSON.parse(permissionsJson) as unknown;
    if (Array.isArray(parsed)) {
      return parsePermissions(permissionsJson);
    }
  } catch {
    // fall through to template
  }
  return permissionsForRole(roleCode);
}

/** True when permissionsJson is missing, blank, or not a JSON array (bootstrap fill). */
export function permissionsJsonNeedsTemplate(
  permissionsJson: string | null | undefined,
): boolean {
  if (permissionsJson == null || !String(permissionsJson).trim()) return true;
  try {
    return !Array.isArray(JSON.parse(permissionsJson));
  } catch {
    return true;
  }
}
