/**
 * Retail domain permission catalog (RET-RBAC-01, Variant A).
 * A role is a package of grants; a door checks a grant, never a role name.
 * Edge-safe: no Prisma, no Node crypto.
 */

export const PERMISSIONS = {
  SCREEN_HOME: "screen:home",
  SCREEN_POS: "screen:pos",
  SCREEN_STOCK_CHECK: "screen:stock_check",
  SCREEN_SETTINGS: "screen:settings",
  SCREEN_ADMIN_ACCESS: "screen:admin.access",

  RECEIPTS_SELL: "api:receipts.sell",
  RECEIPTS_VOID_LINE: "api:receipts.void_line",
  SHIFTS_OPEN: "api:shifts.open",
  SHIFTS_CLOSE: "api:shifts.close",
  SHIFTS_X_REPORT: "api:shifts.x_report",
  STOCK_CHECK: "api:stock.check",
  PRESETS: "api:presets",
  OFFLINE_SYNC: "api:offline.sync",
  FISCAL_DEVICES: "api:fiscal.devices",
  UPLOADS: "api:uploads",
  INTEGRATIONS_STOCK: "api:integrations.stock",

  ADMIN_IMPORT: "admin:import",
  ADMIN_SETTINGS: "admin:settings",
  ACCESS_MANAGE: "admin:access_manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: readonly Permission[] = Object.values(PERMISSIONS);

export const ROLE_CODES = {
  CASHIER: "CASHIER",
  SHIFT_SUPERVISOR: "SHIFT_SUPERVISOR",
  OUTLET_ADMIN: "OUTLET_ADMIN",
  BUSINESS_OWNER: "BUSINESS_OWNER",
  PLATFORM_MEMBER: "PLATFORM_MEMBER",
  SATELLITE_OPERATOR: "SATELLITE_OPERATOR",
} as const;

export type RoleCode = (typeof ROLE_CODES)[keyof typeof ROLE_CODES];

export const SYSTEM_ROLE_CODES: readonly RoleCode[] = Object.values(ROLE_CODES);

export const SYSTEM_ROLE_NAMES: Record<RoleCode, string> = {
  CASHIER: "Cashier",
  SHIFT_SUPERVISOR: "Shift supervisor",
  OUTLET_ADMIN: "Outlet admin",
  BUSINESS_OWNER: "Business Owner",
  PLATFORM_MEMBER: "Platform Member",
  SATELLITE_OPERATOR: "Satellite Operator",
};

/** Holds `admin:access_manage` by default. Does not bypass grants. */
export const ACCESS_MANAGER_ROLE: RoleCode = ROLE_CODES.OUTLET_ADMIN;

/** Template for a legacy role code that is neither a system code nor an alias. */
export const LEGACY_FALLBACK_ROLE: RoleCode = ROLE_CODES.CASHIER;

/** Pre-matrix role codes mapped to the system package that reproduces their access. */
export const ROLE_ALIASES: Record<string, RoleCode> = {
  ADMIN: ROLE_CODES.OUTLET_ADMIN,
  MANAGER: ROLE_CODES.OUTLET_ADMIN,
  OWNER: ROLE_CODES.OUTLET_ADMIN,
  DIRECTOR: ROLE_CODES.OUTLET_ADMIN,
  SUPERVISOR: ROLE_CODES.SHIFT_SUPERVISOR,
};

export const PERMISSION_CATALOG_VERSION = 1;

export type PermissionGroup = {
  id: string;
  labelKey: string;
  permissions: readonly Permission[];
};

export const PERMISSION_GROUPS: readonly PermissionGroup[] = [
  {
    id: "screens",
    labelKey: "groups.screens",
    permissions: [
      PERMISSIONS.SCREEN_HOME,
      PERMISSIONS.SCREEN_POS,
      PERMISSIONS.SCREEN_STOCK_CHECK,
      PERMISSIONS.SCREEN_SETTINGS,
      PERMISSIONS.SCREEN_ADMIN_ACCESS,
    ],
  },
  {
    id: "sales",
    labelKey: "groups.sales",
    permissions: [
      PERMISSIONS.RECEIPTS_SELL,
      PERMISSIONS.RECEIPTS_VOID_LINE,
      PERMISSIONS.PRESETS,
      PERMISSIONS.FISCAL_DEVICES,
      PERMISSIONS.OFFLINE_SYNC,
      PERMISSIONS.UPLOADS,
    ],
  },
  {
    id: "shifts",
    labelKey: "groups.shifts",
    permissions: [
      PERMISSIONS.SHIFTS_OPEN,
      PERMISSIONS.SHIFTS_CLOSE,
      PERMISSIONS.SHIFTS_X_REPORT,
    ],
  },
  {
    id: "stock",
    labelKey: "groups.stock",
    permissions: [PERMISSIONS.STOCK_CHECK, PERMISSIONS.INTEGRATIONS_STOCK],
  },
  {
    id: "admin",
    labelKey: "groups.admin",
    permissions: [
      PERMISSIONS.ADMIN_IMPORT,
      PERMISSIONS.ADMIN_SETTINGS,
      PERMISSIONS.ACCESS_MANAGE,
    ],
  },
];

const CASHIER_TEMPLATE: readonly Permission[] = [
  PERMISSIONS.SCREEN_HOME,
  PERMISSIONS.SCREEN_POS,
  PERMISSIONS.SCREEN_STOCK_CHECK,
  PERMISSIONS.SCREEN_SETTINGS,
  PERMISSIONS.RECEIPTS_SELL,
  PERMISSIONS.SHIFTS_OPEN,
  PERMISSIONS.SHIFTS_CLOSE,
  PERMISSIONS.SHIFTS_X_REPORT,
  PERMISSIONS.STOCK_CHECK,
  PERMISSIONS.PRESETS,
  PERMISSIONS.OFFLINE_SYNC,
  PERMISSIONS.FISCAL_DEVICES,
  PERMISSIONS.UPLOADS,
  PERMISSIONS.INTEGRATIONS_STOCK,
];

const SUPERVISOR_TEMPLATE: readonly Permission[] = [
  ...CASHIER_TEMPLATE,
  PERMISSIONS.RECEIPTS_VOID_LINE,
  PERMISSIONS.ADMIN_IMPORT,
];

/** Seed packages. They reproduce pre-matrix access: only supervisor and outlet admin void or import. */
export const ROLE_TEMPLATES: Record<RoleCode, readonly Permission[]> = {
  CASHIER: CASHIER_TEMPLATE,
  SHIFT_SUPERVISOR: SUPERVISOR_TEMPLATE,
  OUTLET_ADMIN: ALL_PERMISSIONS,
  BUSINESS_OWNER: ALL_PERMISSIONS,
  PLATFORM_MEMBER: CASHIER_TEMPLATE,
  SATELLITE_OPERATOR: CASHIER_TEMPLATE,
};
