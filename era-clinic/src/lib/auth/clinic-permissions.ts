import { CLINIC_ROLE, type ClinicRoleCode } from "@/lib/clinic-roles";

/** Stable permission keys — SSOT for nav, middleware, API, and admin matrix. */
export const CLINIC_PERMISSION = {
  SCREEN_HOME: "screen:home",
  SCREEN_PATIENTS: "screen:patients",
  SCREEN_APPOINTMENTS: "screen:appointments",
  SCREEN_RECEPTION_QUEUE: "screen:reception.queue",
  SCREEN_CASHIER: "screen:cashier",
  SCREEN_RECEPTION_EXTRA_TICKETS: "screen:reception.extra_tickets",
  SCREEN_DOCTOR: "screen:doctor",
  SCREEN_NURSE: "screen:nurse",
  SCREEN_CHECK_IN: "screen:check_in",
  SCREEN_LAB_ORDERS: "screen:lab_orders",
  SCREEN_REPORTS_DIAGNOSES: "screen:reports.diagnoses",
  SCREEN_REPORTS_PROCEDURES: "screen:reports.procedures",
  SCREEN_SANATORIUM: "screen:sanatorium",
  SCREEN_SANATORIUM_RESOURCES: "screen:sanatorium.resources",
  SCREEN_SANATORIUM_NURSE_ROSTER: "screen:sanatorium.nurse_roster",
  SCREEN_INPATIENT: "screen:inpatient",
  SCREEN_INPATIENT_CENSUS: "screen:inpatient.census",
  SCREEN_ADMIN_WARDS: "screen:admin.wards",
  SCREEN_ADMIN_CATALOG: "screen:admin.catalog",
  SCREEN_ADMIN_DIAGNOSTIC_CATALOG: "screen:admin.diagnostic_catalog",
  SCREEN_ADMIN_ICD_FAVORITES: "screen:admin.icd_favorites",
  SCREEN_ADMIN_PROGRAM_TEMPLATES: "screen:admin.program_templates",
  SCREEN_ADMIN_IMPORT: "screen:admin.import",
  SCREEN_ADMIN_PROCEDURE_RULES: "screen:admin.procedure_rules",
  SCREEN_ADMIN_LIS_PROFILES: "screen:admin.lis_profiles",
  SCREEN_ADMIN_MASTER_DATA: "screen:admin.master_data",
  SCREEN_ADMIN_LOOKUPS: "screen:admin.lookups",
  SCREEN_ADMIN_PHYSIO_SITES: "screen:admin.physio_sites",
  SCREEN_ADMIN_AUDIT: "screen:admin.audit",
  SCREEN_ADMIN_SETTINGS: "screen:admin.settings",
  SCREEN_ADMIN_ACCESS: "screen:admin.access",
  ADMIN_ACCESS_MANAGE: "admin:access_manage",
  API_CASHIER: "api:cashier",
  API_SANATORIUM_EPISODES_READ: "api:sanatorium.episodes.read",
  API_SANATORIUM_EPISODES_WRITE: "api:sanatorium.episodes.write",
  API_SANATORIUM_NURSE_ROSTER: "api:sanatorium.nurse_roster",
  API_SANATORIUM_RESOURCES: "api:sanatorium.resources",
  API_SANATORIUM_STAFF_ABSENCES: "api:sanatorium.staff_absences",
  API_PROCEDURES_READ: "api:procedures.read",
  API_PROCEDURES_CHECK_IN: "api:procedures.check_in",
  API_PROCEDURES_COMPLETE: "api:procedures.complete",
  API_PROCEDURES_NO_SHOW: "api:procedures.no_show",
  API_PROCEDURES_RECEPTION: "api:procedures.reception",
  API_PROCEDURES_DOCTOR_RECEPTION: "api:procedures.doctor_reception",
  API_PROCEDURES_ISSUE_TICKET_READ: "api:procedures.issue_ticket.read",
  API_PROCEDURES_ISSUE_TICKET_WRITE: "api:procedures.issue_ticket.write",
  API_APPOINTMENTS_WRITE: "api:appointments.write",
  API_APPOINTMENTS_READ: "api:appointments.read",
  API_LAB_ORDERS_FILE: "api:lab_orders.file",
  API_LAB_ORDERS: "api:lab_orders",
  API_REPORTS_PROCEDURES: "api:reports.procedures",
  API_REPORTS_DIAGNOSES: "api:reports.diagnoses",
  API_NURSE_QR_SCAN: "api:nurse.qr_scan",
  API_NURSE_OVERDUE: "api:nurse.overdue",
  API_PATIENTS: "api:patients",
  API_PROCEDURES_CONFIRM: "api:procedures.confirm",
  /** FO desk manager: out-of-package replace / concessions (CLI-57). */
  API_PROCEDURES_FO_MANAGER: "api:procedures.fo_manager",
  API_INPATIENT: "api:inpatient",
  API_VISITS: "api:visits",
  API_MDM: "api:mdm",
  API_OPS_DAY_SUMMARY: "api:ops.day_summary",
  API_ICD_READ: "api:icd.read",
  API_QUEUE: "api:queue",
  API_CATALOG_READ: "api:catalog.read",
  API_IDENTITY_GUEST_QR: "api:identity.guest_qr",
  /** List/detail: all episodes (else assigned-to-self practitioner). */
  SCOPE_EPISODES_ALL: "scope:episodes.all",
  /** List/detail: all lab orders (else assigned-to-self / own episode). */
  SCOPE_LAB_ORDERS_ALL: "scope:lab_orders.all",
} as const;

export type ClinicPermission =
  (typeof CLINIC_PERMISSION)[keyof typeof CLINIC_PERMISSION];

export const ALL_CLINIC_PERMISSIONS: ClinicPermission[] = Object.values(
  CLINIC_PERMISSION,
);

const COMMON_HOME: ClinicPermission[] = [CLINIC_PERMISSION.SCREEN_HOME];

const COMMON_AUTHENTICATED: ClinicPermission[] = [
  ...COMMON_HOME,
  CLINIC_PERMISSION.SCREEN_PATIENTS,
];

const RECEPTION_SCREENS: ClinicPermission[] = [
  ...COMMON_AUTHENTICATED,
  CLINIC_PERMISSION.SCREEN_APPOINTMENTS,
  CLINIC_PERMISSION.SCREEN_RECEPTION_QUEUE,
  CLINIC_PERMISSION.SCREEN_CASHIER,
  CLINIC_PERMISSION.SCREEN_RECEPTION_EXTRA_TICKETS,
  CLINIC_PERMISSION.SCREEN_SANATORIUM,
  CLINIC_PERMISSION.SCREEN_SANATORIUM_RESOURCES,
  CLINIC_PERMISSION.SCREEN_INPATIENT,
  CLINIC_PERMISSION.SCREEN_INPATIENT_CENSUS,
];

/** Doctors use episode/lab desks; patient registry is off by default (matrix). */
const DOCTOR_SCREENS: ClinicPermission[] = [
  ...COMMON_HOME,
  CLINIC_PERMISSION.SCREEN_DOCTOR,
  CLINIC_PERMISSION.SCREEN_LAB_ORDERS,
  CLINIC_PERMISSION.SCREEN_REPORTS_DIAGNOSES,
  CLINIC_PERMISSION.SCREEN_REPORTS_PROCEDURES,
  CLINIC_PERMISSION.SCREEN_SANATORIUM,
  CLINIC_PERMISSION.SCREEN_SANATORIUM_NURSE_ROSTER,
  CLINIC_PERMISSION.SCREEN_INPATIENT,
  CLINIC_PERMISSION.SCREEN_INPATIENT_CENSUS,
];

const NURSE_SCREENS: ClinicPermission[] = [
  ...COMMON_AUTHENTICATED,
  CLINIC_PERMISSION.SCREEN_NURSE,
  CLINIC_PERMISSION.SCREEN_CHECK_IN,
  CLINIC_PERMISSION.SCREEN_LAB_ORDERS,
  CLINIC_PERMISSION.SCREEN_REPORTS_PROCEDURES,
  CLINIC_PERMISSION.SCREEN_INPATIENT,
  CLINIC_PERMISSION.SCREEN_INPATIENT_CENSUS,
];

const FLOOR_SCREENS: ClinicPermission[] = [
  ...COMMON_AUTHENTICATED,
  CLINIC_PERMISSION.SCREEN_CHECK_IN,
];

const LAB_TECH_SCREENS: ClinicPermission[] = [
  ...COMMON_AUTHENTICATED,
  CLINIC_PERMISSION.SCREEN_LAB_ORDERS,
];

const ADMIN_SCREENS: ClinicPermission[] = [
  CLINIC_PERMISSION.SCREEN_ADMIN_WARDS,
  CLINIC_PERMISSION.SCREEN_ADMIN_CATALOG,
  CLINIC_PERMISSION.SCREEN_ADMIN_DIAGNOSTIC_CATALOG,
  CLINIC_PERMISSION.SCREEN_ADMIN_ICD_FAVORITES,
  CLINIC_PERMISSION.SCREEN_ADMIN_PROGRAM_TEMPLATES,
  CLINIC_PERMISSION.SCREEN_ADMIN_IMPORT,
  CLINIC_PERMISSION.SCREEN_ADMIN_PROCEDURE_RULES,
  CLINIC_PERMISSION.SCREEN_ADMIN_LIS_PROFILES,
  CLINIC_PERMISSION.SCREEN_ADMIN_MASTER_DATA,
  CLINIC_PERMISSION.SCREEN_ADMIN_LOOKUPS,
  CLINIC_PERMISSION.SCREEN_ADMIN_PHYSIO_SITES,
  CLINIC_PERMISSION.SCREEN_ADMIN_AUDIT,
  CLINIC_PERMISSION.SCREEN_ADMIN_SETTINGS,
  CLINIC_PERMISSION.SCREEN_ADMIN_ACCESS,
];

/** Default grants per ops role — mirrors hardcoded nav/middleware/API (2026-09). */
export const DEFAULT_ROLE_PERMISSIONS: Record<ClinicRoleCode, ClinicPermission[]> =
  {
    [CLINIC_ROLE.RECEPTION]: [
      ...RECEPTION_SCREENS,
      CLINIC_PERMISSION.API_CASHIER,
      CLINIC_PERMISSION.API_SANATORIUM_EPISODES_READ,
      CLINIC_PERMISSION.API_SANATORIUM_EPISODES_WRITE,
      CLINIC_PERMISSION.API_SANATORIUM_RESOURCES,
      CLINIC_PERMISSION.API_SANATORIUM_STAFF_ABSENCES,
      CLINIC_PERMISSION.API_PROCEDURES_READ,
      CLINIC_PERMISSION.API_PROCEDURES_RECEPTION,
      CLINIC_PERMISSION.API_PROCEDURES_CONFIRM,
      CLINIC_PERMISSION.API_PROCEDURES_ISSUE_TICKET_WRITE,
      CLINIC_PERMISSION.API_PROCEDURES_ISSUE_TICKET_READ,
      CLINIC_PERMISSION.API_APPOINTMENTS_WRITE,
      CLINIC_PERMISSION.API_APPOINTMENTS_READ,
      CLINIC_PERMISSION.API_LAB_ORDERS_FILE,
      CLINIC_PERMISSION.API_PATIENTS,
      CLINIC_PERMISSION.API_INPATIENT,
      CLINIC_PERMISSION.API_VISITS,
      CLINIC_PERMISSION.API_MDM,
      CLINIC_PERMISSION.API_OPS_DAY_SUMMARY,
      CLINIC_PERMISSION.API_ICD_READ,
      CLINIC_PERMISSION.API_QUEUE,
      CLINIC_PERMISSION.API_CATALOG_READ,
      CLINIC_PERMISSION.API_IDENTITY_GUEST_QR,
      CLINIC_PERMISSION.SCOPE_EPISODES_ALL,
      CLINIC_PERMISSION.SCOPE_LAB_ORDERS_ALL,
    ],
    [CLINIC_ROLE.DOCTOR]: [
      ...DOCTOR_SCREENS,
      CLINIC_PERMISSION.API_SANATORIUM_EPISODES_READ,
      CLINIC_PERMISSION.API_SANATORIUM_EPISODES_WRITE,
      CLINIC_PERMISSION.API_SANATORIUM_NURSE_ROSTER,
      CLINIC_PERMISSION.API_SANATORIUM_RESOURCES,
      CLINIC_PERMISSION.API_SANATORIUM_STAFF_ABSENCES,
      CLINIC_PERMISSION.API_PROCEDURES_READ,
      CLINIC_PERMISSION.API_PROCEDURES_CHECK_IN,
      CLINIC_PERMISSION.API_PROCEDURES_COMPLETE,
      CLINIC_PERMISSION.API_PROCEDURES_NO_SHOW,
      CLINIC_PERMISSION.API_PROCEDURES_DOCTOR_RECEPTION,
      CLINIC_PERMISSION.API_PROCEDURES_CONFIRM,
      CLINIC_PERMISSION.API_PROCEDURES_ISSUE_TICKET_READ,
      CLINIC_PERMISSION.API_LAB_ORDERS_FILE,
      CLINIC_PERMISSION.API_LAB_ORDERS,
      CLINIC_PERMISSION.API_REPORTS_PROCEDURES,
      CLINIC_PERMISSION.API_REPORTS_DIAGNOSES,
      CLINIC_PERMISSION.API_NURSE_QR_SCAN,
      CLINIC_PERMISSION.API_NURSE_OVERDUE,
      CLINIC_PERMISSION.API_APPOINTMENTS_READ,
      CLINIC_PERMISSION.API_INPATIENT,
      CLINIC_PERMISSION.API_VISITS,
      CLINIC_PERMISSION.API_PATIENTS,
      CLINIC_PERMISSION.API_MDM,
      CLINIC_PERMISSION.API_OPS_DAY_SUMMARY,
      CLINIC_PERMISSION.API_ICD_READ,
      CLINIC_PERMISSION.API_CATALOG_READ,
      // no SCOPE_*_ALL → assigned-self rows only
    ],
    [CLINIC_ROLE.NURSE]: [
      ...NURSE_SCREENS,
      CLINIC_PERMISSION.API_PROCEDURES_READ,
      CLINIC_PERMISSION.API_PROCEDURES_CHECK_IN,
      CLINIC_PERMISSION.API_PROCEDURES_COMPLETE,
      CLINIC_PERMISSION.API_PROCEDURES_NO_SHOW,
      CLINIC_PERMISSION.API_PROCEDURES_ISSUE_TICKET_READ,
      CLINIC_PERMISSION.API_LAB_ORDERS_FILE,
      CLINIC_PERMISSION.API_LAB_ORDERS,
      CLINIC_PERMISSION.API_REPORTS_PROCEDURES,
      CLINIC_PERMISSION.API_NURSE_QR_SCAN,
      CLINIC_PERMISSION.API_NURSE_OVERDUE,
      CLINIC_PERMISSION.API_SANATORIUM_RESOURCES,
      CLINIC_PERMISSION.API_SANATORIUM_EPISODES_READ,
      CLINIC_PERMISSION.API_PATIENTS,
      CLINIC_PERMISSION.API_INPATIENT,
      CLINIC_PERMISSION.API_OPS_DAY_SUMMARY,
      CLINIC_PERMISSION.API_ICD_READ,
      CLINIC_PERMISSION.API_CATALOG_READ,
      CLINIC_PERMISSION.API_IDENTITY_GUEST_QR,
      CLINIC_PERMISSION.SCOPE_EPISODES_ALL,
      CLINIC_PERMISSION.SCOPE_LAB_ORDERS_ALL,
    ],
    [CLINIC_ROLE.FLOOR]: [
      ...FLOOR_SCREENS,
      CLINIC_PERMISSION.API_PROCEDURES_READ,
      CLINIC_PERMISSION.API_PROCEDURES_CHECK_IN,
      CLINIC_PERMISSION.API_PATIENTS,
      CLINIC_PERMISSION.API_CATALOG_READ,
      CLINIC_PERMISSION.API_IDENTITY_GUEST_QR,
    ],
    [CLINIC_ROLE.LAB_TECH]: [
      ...LAB_TECH_SCREENS,
      CLINIC_PERMISSION.API_LAB_ORDERS_FILE,
      CLINIC_PERMISSION.API_LAB_ORDERS,
      CLINIC_PERMISSION.API_PATIENTS,
      CLINIC_PERMISSION.API_CATALOG_READ,
      CLINIC_PERMISSION.SCOPE_LAB_ORDERS_ALL,
    ],
    [CLINIC_ROLE.CLINIC_ADMIN]: [...ALL_CLINIC_PERMISSIONS],
  };

export type PermissionGroupId =
  | "common"
  | "frontdesk"
  | "clinical"
  | "sanatorium"
  | "inpatient"
  | "admin"
  | "api"
  | "scope";

export type PermissionGroup = {
  id: PermissionGroupId;
  labelKey: string;
  permissions: ClinicPermission[];
};

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: "common",
    labelKey: "groupCommon",
    permissions: [...COMMON_AUTHENTICATED],
  },
  {
    id: "frontdesk",
    labelKey: "groupFrontdesk",
    permissions: [
      CLINIC_PERMISSION.SCREEN_APPOINTMENTS,
      CLINIC_PERMISSION.SCREEN_RECEPTION_QUEUE,
      CLINIC_PERMISSION.SCREEN_CASHIER,
      CLINIC_PERMISSION.SCREEN_RECEPTION_EXTRA_TICKETS,
    ],
  },
  {
    id: "clinical",
    labelKey: "groupClinical",
    permissions: [
      CLINIC_PERMISSION.SCREEN_DOCTOR,
      CLINIC_PERMISSION.SCREEN_NURSE,
      CLINIC_PERMISSION.SCREEN_CHECK_IN,
      CLINIC_PERMISSION.SCREEN_LAB_ORDERS,
      CLINIC_PERMISSION.SCREEN_REPORTS_DIAGNOSES,
      CLINIC_PERMISSION.SCREEN_REPORTS_PROCEDURES,
    ],
  },
  {
    id: "sanatorium",
    labelKey: "groupSanatorium",
    permissions: [
      CLINIC_PERMISSION.SCREEN_SANATORIUM,
      CLINIC_PERMISSION.SCREEN_SANATORIUM_RESOURCES,
      CLINIC_PERMISSION.SCREEN_SANATORIUM_NURSE_ROSTER,
    ],
  },
  {
    id: "inpatient",
    labelKey: "groupInpatient",
    permissions: [
      CLINIC_PERMISSION.SCREEN_INPATIENT,
      CLINIC_PERMISSION.SCREEN_INPATIENT_CENSUS,
      CLINIC_PERMISSION.SCREEN_ADMIN_WARDS,
    ],
  },
  {
    id: "admin",
    labelKey: "groupAdmin",
    permissions: [
      ...ADMIN_SCREENS.filter((p) => p !== CLINIC_PERMISSION.SCREEN_ADMIN_ACCESS),
      CLINIC_PERMISSION.SCREEN_ADMIN_ACCESS,
      CLINIC_PERMISSION.ADMIN_ACCESS_MANAGE,
    ],
  },
  {
    id: "api",
    labelKey: "groupApi",
    permissions: ALL_CLINIC_PERMISSIONS.filter((p) => p.startsWith("api:")),
  },
  {
    id: "scope",
    labelKey: "groupScope",
    permissions: [
      CLINIC_PERMISSION.SCOPE_EPISODES_ALL,
      CLINIC_PERMISSION.SCOPE_LAB_ORDERS_ALL,
    ],
  },
];

const PERMISSION_SET = new Set<string>(ALL_CLINIC_PERMISSIONS);

/** Pre-single-SoT key — expand into diagnostic + program template screens. */
const LEGACY_SCREEN_ADMIN_TEMPLATES = "screen:admin.templates";

export function isClinicPermission(value: string): value is ClinicPermission {
  return PERMISSION_SET.has(value);
}

/** Map stored JSON (incl. legacy keys) → current ClinicPermission[]. */
export function migrateStoredPermissions(raw: unknown[]): ClinicPermission[] {
  const out = new Set<ClinicPermission>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    if (item === LEGACY_SCREEN_ADMIN_TEMPLATES) {
      out.add(CLINIC_PERMISSION.SCREEN_ADMIN_DIAGNOSTIC_CATALOG);
      out.add(CLINIC_PERMISSION.SCREEN_ADMIN_PROGRAM_TEMPLATES);
      continue;
    }
    if (isClinicPermission(item)) out.add(item);
  }
  return [...out];
}

export function parseRolePermissions(json: string): ClinicPermission[] {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return migrateStoredPermissions(parsed);
  } catch {
    return [];
  }
}

export function serializeRolePermissions(perms: ClinicPermission[]): string {
  return JSON.stringify([...new Set(perms)].sort());
}

export function defaultPermissionsForRole(
  roleCode: string,
): ClinicPermission[] {
  const code = roleCode as ClinicRoleCode;
  return DEFAULT_ROLE_PERMISSIONS[code] ?? [...COMMON_AUTHENTICATED];
}

export function effectiveRolePermissions(
  roleCode: string,
  permissionsJson: string,
): ClinicPermission[] {
  const stored = parseRolePermissions(permissionsJson);
  if (stored.length > 0) return stored;
  return defaultPermissionsForRole(roleCode);
}

export function permissionsJsonForRole(roleCode: string): string {
  return serializeRolePermissions(defaultPermissionsForRole(roleCode));
}

/** Map nav href → screen permission (top nav included). */
const ROUTE_PERMISSION_EXACT: Record<string, ClinicPermission> = {
  "/": CLINIC_PERMISSION.SCREEN_HOME,
  "/patients": CLINIC_PERMISSION.SCREEN_PATIENTS,
  "/appointments": CLINIC_PERMISSION.SCREEN_APPOINTMENTS,
  "/reception/queue": CLINIC_PERMISSION.SCREEN_RECEPTION_QUEUE,
  "/cashier": CLINIC_PERMISSION.SCREEN_CASHIER,
  "/reception/extra-tickets": CLINIC_PERMISSION.SCREEN_RECEPTION_EXTRA_TICKETS,
  "/doctor": CLINIC_PERMISSION.SCREEN_DOCTOR,
  "/nurse": CLINIC_PERMISSION.SCREEN_NURSE,
  "/check-in": CLINIC_PERMISSION.SCREEN_CHECK_IN,
  "/lab-orders": CLINIC_PERMISSION.SCREEN_LAB_ORDERS,
  "/reports/diagnoses": CLINIC_PERMISSION.SCREEN_REPORTS_DIAGNOSES,
  "/reports/procedures": CLINIC_PERMISSION.SCREEN_REPORTS_PROCEDURES,
  "/sanatorium": CLINIC_PERMISSION.SCREEN_SANATORIUM,
  "/sanatorium/resources": CLINIC_PERMISSION.SCREEN_SANATORIUM_RESOURCES,
  "/sanatorium/nurse-roster": CLINIC_PERMISSION.SCREEN_SANATORIUM_NURSE_ROSTER,
  "/inpatient": CLINIC_PERMISSION.SCREEN_INPATIENT,
  "/inpatient/census": CLINIC_PERMISSION.SCREEN_INPATIENT_CENSUS,
  "/admin/wards": CLINIC_PERMISSION.SCREEN_ADMIN_WARDS,
  "/admin/catalog": CLINIC_PERMISSION.SCREEN_ADMIN_CATALOG,
  "/admin/diagnostic-catalog": CLINIC_PERMISSION.SCREEN_ADMIN_DIAGNOSTIC_CATALOG,
  "/admin/icd-favorites": CLINIC_PERMISSION.SCREEN_ADMIN_ICD_FAVORITES,
  "/admin/program-templates": CLINIC_PERMISSION.SCREEN_ADMIN_PROGRAM_TEMPLATES,
  "/admin/import": CLINIC_PERMISSION.SCREEN_ADMIN_IMPORT,
  "/admin/procedure-rules": CLINIC_PERMISSION.SCREEN_ADMIN_PROCEDURE_RULES,
  "/admin/lis-profiles": CLINIC_PERMISSION.SCREEN_ADMIN_LIS_PROFILES,
  "/admin/master-data": CLINIC_PERMISSION.SCREEN_ADMIN_MASTER_DATA,
  "/admin/lookups": CLINIC_PERMISSION.SCREEN_ADMIN_LOOKUPS,
  "/admin/physio-sites": CLINIC_PERMISSION.SCREEN_ADMIN_PHYSIO_SITES,
  "/admin/audit": CLINIC_PERMISSION.SCREEN_ADMIN_AUDIT,
  "/admin/settings": CLINIC_PERMISSION.SCREEN_ADMIN_SETTINGS,
  "/admin/access": CLINIC_PERMISSION.SCREEN_ADMIN_ACCESS,
};

const ROUTE_PREFIX_PERMISSIONS: Array<{ prefix: string; permission: ClinicPermission }> =
  [
    { prefix: "/doctor/", permission: CLINIC_PERMISSION.SCREEN_DOCTOR },
    { prefix: "/nurse/", permission: CLINIC_PERMISSION.SCREEN_NURSE },
    { prefix: "/sanatorium/nurse-roster", permission: CLINIC_PERMISSION.SCREEN_SANATORIUM_NURSE_ROSTER },
    { prefix: "/sanatorium/resources", permission: CLINIC_PERMISSION.SCREEN_SANATORIUM_RESOURCES },
    { prefix: "/sanatorium/", permission: CLINIC_PERMISSION.SCREEN_SANATORIUM },
    { prefix: "/admin/", permission: CLINIC_PERMISSION.SCREEN_ADMIN_SETTINGS },
  ];

/** Resolve page pathname to a screen permission (null = auth-only, no extra gate). */
export function routePermission(pathname: string): ClinicPermission | null {
  if (pathname.startsWith("/print") || pathname.startsWith("/portal")) {
    return null;
  }
  if (pathname === "/admin" || pathname === "/admin/") {
    return CLINIC_PERMISSION.SCREEN_ADMIN_MASTER_DATA;
  }
  const exact = ROUTE_PERMISSION_EXACT[pathname];
  if (exact) return exact;
  for (const { prefix, permission } of ROUTE_PREFIX_PERMISSIONS) {
    if (pathname === prefix || pathname.startsWith(prefix)) {
      return permission;
    }
  }
  if (pathname.startsWith("/patients/")) {
    return CLINIC_PERMISSION.SCREEN_PATIENTS;
  }
  return null;
}

/**
 * Map admin API pathname → screen permission (longest prefix first).
 * Used by assertClinicAdminRoute — CLINIC_ADMIN matrix applies.
 */
const ADMIN_API_PREFIX_PERMISSIONS: Array<{
  prefix: string;
  permission: ClinicPermission;
}> = [
  { prefix: "/api/admin/catalog/import-nafta", permission: CLINIC_PERMISSION.SCREEN_ADMIN_IMPORT },
  { prefix: "/api/import", permission: CLINIC_PERMISSION.SCREEN_ADMIN_IMPORT },
  { prefix: "/api/admin/diagnostic-catalog", permission: CLINIC_PERMISSION.SCREEN_ADMIN_DIAGNOSTIC_CATALOG },
  { prefix: "/api/admin/icd-favorites", permission: CLINIC_PERMISSION.SCREEN_ADMIN_ICD_FAVORITES },
  { prefix: "/api/admin/procedure-rules", permission: CLINIC_PERMISSION.SCREEN_ADMIN_PROCEDURE_RULES },
  {
    prefix: "/api/admin/procedure-compatibility-rules",
    permission: CLINIC_PERMISSION.SCREEN_ADMIN_PROCEDURE_RULES,
  },
  {
    prefix: "/api/admin/procedure-rotation-rules",
    permission: CLINIC_PERMISSION.SCREEN_ADMIN_PROCEDURE_RULES,
  },
  {
    prefix: "/api/admin/procedure-substitution-rules",
    permission: CLINIC_PERMISSION.SCREEN_ADMIN_PROCEDURE_RULES,
  },
  { prefix: "/api/admin/lis-profiles", permission: CLINIC_PERMISSION.SCREEN_ADMIN_LIS_PROFILES },
  { prefix: "/api/admin/practitioners", permission: CLINIC_PERMISSION.SCREEN_ADMIN_MASTER_DATA },
  { prefix: "/api/admin/rooms", permission: CLINIC_PERMISSION.SCREEN_ADMIN_MASTER_DATA },
  { prefix: "/api/admin/resources", permission: CLINIC_PERMISSION.SCREEN_ADMIN_MASTER_DATA },
  { prefix: "/api/admin/program-templates", permission: CLINIC_PERMISSION.SCREEN_ADMIN_PROGRAM_TEMPLATES },
  { prefix: "/api/admin/catalog-favorites", permission: CLINIC_PERMISSION.SCREEN_ADMIN_MASTER_DATA },
  { prefix: "/api/admin/procedure-types", permission: CLINIC_PERMISSION.SCREEN_ADMIN_MASTER_DATA },
  { prefix: "/api/admin/catalog", permission: CLINIC_PERMISSION.SCREEN_ADMIN_CATALOG },
  { prefix: "/api/admin/lookups", permission: CLINIC_PERMISSION.SCREEN_ADMIN_LOOKUPS },
  { prefix: "/api/admin/physio-sites", permission: CLINIC_PERMISSION.SCREEN_ADMIN_PHYSIO_SITES },
  { prefix: "/api/admin/physio-lists", permission: CLINIC_PERMISSION.SCREEN_ADMIN_PHYSIO_SITES },
  { prefix: "/api/admin/physio-nahiye-queue", permission: CLINIC_PERMISSION.SCREEN_ADMIN_PHYSIO_SITES },
  { prefix: "/api/admin/settings", permission: CLINIC_PERMISSION.SCREEN_ADMIN_SETTINGS },
  { prefix: "/api/admin/workforce-policy", permission: CLINIC_PERMISSION.SCREEN_ADMIN_SETTINGS },
  { prefix: "/api/admin/finance-products", permission: CLINIC_PERMISSION.SCREEN_ADMIN_SETTINGS },
  { prefix: "/api/admin/wards", permission: CLINIC_PERMISSION.SCREEN_ADMIN_WARDS },
  { prefix: "/api/admin/beds", permission: CLINIC_PERMISSION.SCREEN_ADMIN_WARDS },
  { prefix: "/api/admin/roles", permission: CLINIC_PERMISSION.SCREEN_ADMIN_ACCESS },
  { prefix: "/api/audit", permission: CLINIC_PERMISSION.SCREEN_ADMIN_AUDIT },
  { prefix: "/api/catalog/sync", permission: CLINIC_PERMISSION.SCREEN_ADMIN_CATALOG },
];

export function adminApiRoutePermission(
  pathname: string,
): ClinicPermission | null {
  const path = pathname.split("?")[0] ?? pathname;
  let best: { prefix: string; permission: ClinicPermission } | null = null;
  for (const row of ADMIN_API_PREFIX_PERMISSIONS) {
    if (path === row.prefix || path.startsWith(`${row.prefix}/`)) {
      if (!best || row.prefix.length > best.prefix.length) best = row;
    }
  }
  return best?.permission ?? null;
}

/**
 * Map staff (non-admin) API pathname → coarse permission (longest prefix).
 * Method-specific overrides (e.g. appointments GET vs POST) stay in handlers.
 */
const OPS_API_PREFIX_PERMISSIONS: Array<{
  prefix: string;
  permission: ClinicPermission;
}> = [
  { prefix: "/api/procedures/confirm", permission: CLINIC_PERMISSION.API_PROCEDURES_CONFIRM },
  { prefix: "/api/procedures/bulk-cancel", permission: CLINIC_PERMISSION.API_PROCEDURES_RECEPTION },
  { prefix: "/api/procedures", permission: CLINIC_PERMISSION.API_PROCEDURES_READ },
  { prefix: "/api/lab-orders", permission: CLINIC_PERMISSION.API_LAB_ORDERS },
  { prefix: "/api/lab", permission: CLINIC_PERMISSION.API_LAB_ORDERS },
  { prefix: "/api/patients", permission: CLINIC_PERMISSION.API_PATIENTS },
  { prefix: "/api/appointments", permission: CLINIC_PERMISSION.API_APPOINTMENTS_WRITE },
  { prefix: "/api/queue", permission: CLINIC_PERMISSION.API_QUEUE },
  { prefix: "/api/visits", permission: CLINIC_PERMISSION.API_VISITS },
  { prefix: "/api/inpatient", permission: CLINIC_PERMISSION.API_INPATIENT },
  { prefix: "/api/reports/diagnoses", permission: CLINIC_PERMISSION.API_REPORTS_DIAGNOSES },
  { prefix: "/api/reports/procedures", permission: CLINIC_PERMISSION.API_REPORTS_PROCEDURES },
  { prefix: "/api/mdm", permission: CLINIC_PERMISSION.API_MDM },
  { prefix: "/api/icd", permission: CLINIC_PERMISSION.API_ICD_READ },
  { prefix: "/api/ops/day-summary", permission: CLINIC_PERMISSION.API_OPS_DAY_SUMMARY },
  { prefix: "/api/diagnostic-catalog", permission: CLINIC_PERMISSION.API_CATALOG_READ },
  { prefix: "/api/physio-catalog", permission: CLINIC_PERMISSION.API_CATALOG_READ },
  { prefix: "/api/procedure-types", permission: CLINIC_PERMISSION.API_CATALOG_READ },
  { prefix: "/api/catalog/services", permission: CLINIC_PERMISSION.API_CATALOG_READ },
  { prefix: "/api/imaging-phrases", permission: CLINIC_PERMISSION.API_CATALOG_READ },
  { prefix: "/api/identity/guest-qr", permission: CLINIC_PERMISSION.API_IDENTITY_GUEST_QR },
  { prefix: "/api/billing/context", permission: CLINIC_PERMISSION.API_CASHIER },
  { prefix: "/api/cashier", permission: CLINIC_PERMISSION.API_CASHIER },
  { prefix: "/api/insurance/check", permission: CLINIC_PERMISSION.API_PATIENTS },
  { prefix: "/api/nurse/qr-scan", permission: CLINIC_PERMISSION.API_NURSE_QR_SCAN },
  { prefix: "/api/nurse/overdue", permission: CLINIC_PERMISSION.API_NURSE_OVERDUE },
  { prefix: "/api/sanatorium/resources", permission: CLINIC_PERMISSION.API_SANATORIUM_RESOURCES },
  { prefix: "/api/sanatorium/nurse-roster", permission: CLINIC_PERMISSION.API_SANATORIUM_NURSE_ROSTER },
  { prefix: "/api/sanatorium/staff-absences", permission: CLINIC_PERMISSION.API_SANATORIUM_STAFF_ABSENCES },
  {
    prefix: "/api/sanatorium/program-templates",
    permission: CLINIC_PERMISSION.API_SANATORIUM_EPISODES_READ,
  },
  {
    prefix: "/api/sanatorium/episodes",
    permission: CLINIC_PERMISSION.API_SANATORIUM_EPISODES_WRITE,
  },
];

export function opsApiRoutePermission(
  pathname: string,
): ClinicPermission | null {
  const path = pathname.split("?")[0] ?? pathname;
  let best: { prefix: string; permission: ClinicPermission } | null = null;
  for (const row of OPS_API_PREFIX_PERMISSIONS) {
    if (path === row.prefix || path.startsWith(`${row.prefix}/`)) {
      if (!best || row.prefix.length > best.prefix.length) best = row;
    }
  }
  return best?.permission ?? null;
}

export function navEntryPermission(
  entry: { permission?: ClinicPermission | string | null },
): ClinicPermission | null {
  const p = entry.permission;
  if (!p || typeof p !== "string") return null;
  return isClinicPermission(p) ? p : null;
}

export const CONFIGURABLE_CLINIC_ROLES: ClinicRoleCode[] = [
  CLINIC_ROLE.RECEPTION,
  CLINIC_ROLE.DOCTOR,
  CLINIC_ROLE.NURSE,
  CLINIC_ROLE.FLOOR,
  CLINIC_ROLE.LAB_TECH,
  CLINIC_ROLE.CLINIC_ADMIN,
];
