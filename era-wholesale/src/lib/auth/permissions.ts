/**
 * Wholesale domain permission catalog (WS-RBAC-01, Variant A).
 * A role is a package of grants; a door checks a grant, never a role name.
 * Edge-safe: no Prisma, no Node crypto.
 */

export const PERMISSIONS = {
  SCREEN_HOME: "screen:home",
  SCREEN_ORDERS: "screen:orders",
  SCREEN_PICK_LISTS: "screen:pick_lists",
  SCREEN_ADMIN_IMPORT_ORDERS: "screen:admin.import_orders",
  SCREEN_ADMIN_SETTINGS: "screen:admin.settings",
  SCREEN_ADMIN_ACCESS: "screen:admin.access",

  ORDERS: "api:orders",
  ORDERS_CONFIRM: "api:orders.confirm",
  ORDERS_PAY: "api:orders.pay",
  ORDERS_TTN: "api:orders.ttn",
  PICK: "api:pick",
  PICK_WAVES: "api:pick_waves",
  CREDIT_LIMIT: "api:credit_limit",
  EDI_EXPORT: "api:edi.export",
  FX_PREVIEW: "api:fx_preview",

  ADMIN_IMPORT_ORDERS: "admin:import_orders",
  ACCESS_MANAGE: "admin:access_manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: readonly Permission[] = Object.values(PERMISSIONS);

export const ROLE_CODES = {
  SALES_REP: "SALES_REP",
  WAREHOUSE_PICKER: "WAREHOUSE_PICKER",
  WHOLESALE_MANAGER: "WHOLESALE_MANAGER",
  BUSINESS_OWNER: "BUSINESS_OWNER",
  PLATFORM_MEMBER: "PLATFORM_MEMBER",
  SATELLITE_OPERATOR: "SATELLITE_OPERATOR",
} as const;

export type RoleCode = (typeof ROLE_CODES)[keyof typeof ROLE_CODES];

export const SYSTEM_ROLE_CODES: readonly RoleCode[] = Object.values(ROLE_CODES);

export const SYSTEM_ROLE_NAMES: Record<RoleCode, string> = {
  SALES_REP: "Sales rep",
  WAREHOUSE_PICKER: "Warehouse picker",
  WHOLESALE_MANAGER: "Wholesale manager",
  BUSINESS_OWNER: "Business Owner",
  PLATFORM_MEMBER: "Platform Member",
  SATELLITE_OPERATOR: "Satellite Operator",
};

/** Holds `admin:access_manage` by default. Does not bypass grants. */
export const ACCESS_MANAGER_ROLE: RoleCode = ROLE_CODES.WHOLESALE_MANAGER;

/** Template for a legacy role code that is neither a system code nor an alias. */
export const LEGACY_FALLBACK_ROLE: RoleCode = ROLE_CODES.SALES_REP;

/** Pre-matrix role codes mapped to the system package that reproduces their access. */
export const ROLE_ALIASES: Record<string, RoleCode> = {
  ADMIN: ROLE_CODES.WHOLESALE_MANAGER,
  MANAGER: ROLE_CODES.WHOLESALE_MANAGER,
  OWNER: ROLE_CODES.WHOLESALE_MANAGER,
  DIRECTOR: ROLE_CODES.WHOLESALE_MANAGER,
  SALES_AGENT: ROLE_CODES.SALES_REP,
  REP: ROLE_CODES.SALES_REP,
  PICKER: ROLE_CODES.WAREHOUSE_PICKER,
  STOREKEEPER: ROLE_CODES.WAREHOUSE_PICKER,
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
      PERMISSIONS.SCREEN_ORDERS,
      PERMISSIONS.SCREEN_PICK_LISTS,
      PERMISSIONS.SCREEN_ADMIN_IMPORT_ORDERS,
      PERMISSIONS.SCREEN_ADMIN_SETTINGS,
      PERMISSIONS.SCREEN_ADMIN_ACCESS,
    ],
  },
  {
    id: "orders",
    labelKey: "groups.orders",
    permissions: [
      PERMISSIONS.ORDERS,
      PERMISSIONS.ORDERS_CONFIRM,
      PERMISSIONS.ORDERS_PAY,
      PERMISSIONS.ORDERS_TTN,
      PERMISSIONS.CREDIT_LIMIT,
      PERMISSIONS.EDI_EXPORT,
      PERMISSIONS.FX_PREVIEW,
    ],
  },
  {
    id: "warehouse",
    labelKey: "groups.warehouse",
    permissions: [PERMISSIONS.PICK, PERMISSIONS.PICK_WAVES],
  },
  {
    id: "admin",
    labelKey: "groups.admin",
    permissions: [PERMISSIONS.ADMIN_IMPORT_ORDERS, PERMISSIONS.ACCESS_MANAGE],
  },
];

const OPS_TEMPLATE: readonly Permission[] = [
  PERMISSIONS.SCREEN_HOME,
  PERMISSIONS.SCREEN_ORDERS,
  PERMISSIONS.SCREEN_PICK_LISTS,
  PERMISSIONS.ORDERS,
  PERMISSIONS.ORDERS_CONFIRM,
  PERMISSIONS.ORDERS_PAY,
  PERMISSIONS.ORDERS_TTN,
  PERMISSIONS.PICK,
  PERMISSIONS.PICK_WAVES,
  PERMISSIONS.CREDIT_LIMIT,
  PERMISSIONS.EDI_EXPORT,
  PERMISSIONS.FX_PREVIEW,
];

/** Seed packages. Every ops role keeps the full order and pick flow; import orders and settings go to the manager. */
export const ROLE_TEMPLATES: Record<RoleCode, readonly Permission[]> = {
  SALES_REP: OPS_TEMPLATE,
  WAREHOUSE_PICKER: OPS_TEMPLATE,
  WHOLESALE_MANAGER: ALL_PERMISSIONS,
  BUSINESS_OWNER: ALL_PERMISSIONS,
  PLATFORM_MEMBER: OPS_TEMPLATE,
  SATELLITE_OPERATOR: OPS_TEMPLATE,
};
