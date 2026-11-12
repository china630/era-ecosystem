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
  ORDERS_READ: "api:orders.read",
  ORDERS_CONFIRM: "api:orders.confirm",
  ORDERS_PAY: "api:orders.pay",
  ORDERS_TTN: "api:orders.ttn",
  PICK: "api:pick",
  PICK_READ: "api:pick.read",
  PICK_WAVES: "api:pick_waves",
  PICK_WAVES_READ: "api:pick_waves.read",
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

export const PERMISSION_CATALOG_VERSION = 2;

/** GET uses the read key. The original key stays on writes. Copied once from the write key. */
export const READ_OF_WRITE: Readonly<Record<string, Permission>> = {
  [PERMISSIONS.ORDERS]: PERMISSIONS.ORDERS_READ,
  [PERMISSIONS.PICK]: PERMISSIONS.PICK_READ,
  [PERMISSIONS.PICK_WAVES]: PERMISSIONS.PICK_WAVES_READ,
};

export function expandEntityReads(keys: readonly string[]): Permission[] {
  const out: Permission[] = [];
  const have = new Set<string>();
  const add = (key: string) => {
    if (!have.has(key)) {
      have.add(key);
      out.push(key as Permission);
    }
  };
  for (const key of keys) add(key);
  for (const key of keys) {
    const read = READ_OF_WRITE[key];
    if (read) add(read);
  }
  return out;
}

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
      PERMISSIONS.ORDERS_READ,
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
    permissions: [
      PERMISSIONS.PICK,
      PERMISSIONS.PICK_READ,
      PERMISSIONS.PICK_WAVES,
      PERMISSIONS.PICK_WAVES_READ,
    ],
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
  SALES_REP: expandEntityReads(OPS_TEMPLATE),
  WAREHOUSE_PICKER: expandEntityReads(OPS_TEMPLATE),
  WHOLESALE_MANAGER: ALL_PERMISSIONS,
  BUSINESS_OWNER: ALL_PERMISSIONS,
  PLATFORM_MEMBER: expandEntityReads(OPS_TEMPLATE),
  SATELLITE_OPERATOR: expandEntityReads(OPS_TEMPLATE),
};

export type AccessColumn = "view" | "change" | "operate" | "admin";

/** One row per entity. Each catalog key appears in exactly one cell. */
export const ENTITY_ACCESS_MATRIX: {
  id: string;
  cells: Partial<Record<AccessColumn, Permission[]>>;
}[] = [
  {
    id: "order",
    cells: {
      view: [PERMISSIONS.ORDERS_READ, PERMISSIONS.SCREEN_ORDERS, PERMISSIONS.SCREEN_HOME],
      change: [PERMISSIONS.ORDERS],
      operate: [PERMISSIONS.ORDERS_CONFIRM, PERMISSIONS.ORDERS_PAY, PERMISSIONS.ORDERS_TTN],
    },
  },
  {
    id: "pick",
    cells: {
      view: [PERMISSIONS.PICK_READ, PERMISSIONS.SCREEN_PICK_LISTS],
      change: [PERMISSIONS.PICK],
    },
  },
  {
    id: "wave",
    cells: {
      view: [PERMISSIONS.PICK_WAVES_READ],
      change: [PERMISSIONS.PICK_WAVES],
    },
  },
  { id: "credit", cells: { view: [PERMISSIONS.CREDIT_LIMIT] } },
  {
    id: "edi",
    cells: {
      view: [PERMISSIONS.FX_PREVIEW],
      operate: [PERMISSIONS.EDI_EXPORT],
      admin: [PERMISSIONS.ADMIN_IMPORT_ORDERS, PERMISSIONS.SCREEN_ADMIN_IMPORT_ORDERS],
    },
  },
  {
    id: "access",
    cells: {
      view: [PERMISSIONS.SCREEN_ADMIN_ACCESS, PERMISSIONS.SCREEN_ADMIN_SETTINGS],
      admin: [PERMISSIONS.ACCESS_MANAGE],
    },
  },
];
