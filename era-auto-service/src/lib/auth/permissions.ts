/**
 * Auto service domain permission catalog (AS-RBAC-01, Variant A).
 * A role is a package of grants; a door checks a grant, never a role name.
 * Edge-safe: no Prisma, no Node crypto.
 */

export const PERMISSIONS = {
  SCREEN_HOME: "screen:home",
  SCREEN_WORK_ORDERS: "screen:work_orders",
  SCREEN_APPOINTMENTS: "screen:appointments",
  SCREEN_ADMIN_SETTINGS: "screen:admin.settings",
  SCREEN_ADMIN_ACCESS: "screen:admin.access",

  WORK_ORDERS: "api:work_orders",
  WORK_ORDERS_READ: "api:work_orders.read",
  APPOINTMENTS: "api:appointments",
  APPOINTMENTS_READ: "api:appointments.read",
  VEHICLES: "api:vehicles",
  VEHICLES_READ: "api:vehicles.read",
  PARTS_CATALOG: "api:parts.catalog",
  PARTS_CATALOG_READ: "api:parts.catalog.read",
  TOOLS: "api:tools",
  TOOLS_READ: "api:tools.read",
  CALENDAR: "api:calendar",
  CALENDAR_READ: "api:calendar.read",

  ADMIN_SETTINGS: "admin:settings",
  ACCESS_MANAGE: "admin:access_manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: readonly Permission[] = Object.values(PERMISSIONS);

export const ROLE_CODES = {
  SERVICE_ADVISOR: "SERVICE_ADVISOR",
  TECHNICIAN: "TECHNICIAN",
  STO_MANAGER: "STO_MANAGER",
  BUSINESS_OWNER: "BUSINESS_OWNER",
  PLATFORM_MEMBER: "PLATFORM_MEMBER",
  SATELLITE_OPERATOR: "SATELLITE_OPERATOR",
} as const;

export type RoleCode = (typeof ROLE_CODES)[keyof typeof ROLE_CODES];

export const SYSTEM_ROLE_CODES: readonly RoleCode[] = Object.values(ROLE_CODES);

export const SYSTEM_ROLE_NAMES: Record<RoleCode, string> = {
  SERVICE_ADVISOR: "Service advisor",
  TECHNICIAN: "Technician",
  STO_MANAGER: "Service station manager",
  BUSINESS_OWNER: "Business Owner",
  PLATFORM_MEMBER: "Platform Member",
  SATELLITE_OPERATOR: "Satellite Operator",
};

/** Holds `admin:access_manage` by default. Does not bypass grants. */
export const ACCESS_MANAGER_ROLE: RoleCode = ROLE_CODES.STO_MANAGER;

/** Template for a legacy role code that is neither a system code nor an alias. */
export const LEGACY_FALLBACK_ROLE: RoleCode = ROLE_CODES.SERVICE_ADVISOR;

/** Pre-matrix role codes mapped to the system package that reproduces their access. */
export const ROLE_ALIASES: Record<string, RoleCode> = {
  ADMIN: ROLE_CODES.STO_MANAGER,
  MANAGER: ROLE_CODES.STO_MANAGER,
  OWNER: ROLE_CODES.STO_MANAGER,
  DIRECTOR: ROLE_CODES.STO_MANAGER,
  ADVISOR: ROLE_CODES.SERVICE_ADVISOR,
  RECEPTION: ROLE_CODES.SERVICE_ADVISOR,
  MECHANIC: ROLE_CODES.TECHNICIAN,
};

export const PERMISSION_CATALOG_VERSION = 2;

export const READ_OF_WRITE: Readonly<Record<string, Permission>> = {
  [PERMISSIONS.WORK_ORDERS]: PERMISSIONS.WORK_ORDERS_READ,
  [PERMISSIONS.APPOINTMENTS]: PERMISSIONS.APPOINTMENTS_READ,
  [PERMISSIONS.VEHICLES]: PERMISSIONS.VEHICLES_READ,
  [PERMISSIONS.PARTS_CATALOG]: PERMISSIONS.PARTS_CATALOG_READ,
  [PERMISSIONS.TOOLS]: PERMISSIONS.TOOLS_READ,
  [PERMISSIONS.CALENDAR]: PERMISSIONS.CALENDAR_READ,
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
      PERMISSIONS.SCREEN_WORK_ORDERS,
      PERMISSIONS.SCREEN_APPOINTMENTS,
      PERMISSIONS.SCREEN_ADMIN_SETTINGS,
      PERMISSIONS.SCREEN_ADMIN_ACCESS,
    ],
  },
  {
    id: "workshop",
    labelKey: "groups.workshop",
    permissions: [
      PERMISSIONS.WORK_ORDERS,
      PERMISSIONS.WORK_ORDERS_READ,
      PERMISSIONS.APPOINTMENTS,
      PERMISSIONS.APPOINTMENTS_READ,
      PERMISSIONS.VEHICLES,
      PERMISSIONS.VEHICLES_READ,
      PERMISSIONS.PARTS_CATALOG,
      PERMISSIONS.PARTS_CATALOG_READ,
      PERMISSIONS.TOOLS,
      PERMISSIONS.TOOLS_READ,
      PERMISSIONS.CALENDAR,
      PERMISSIONS.CALENDAR_READ,
    ],
  },
  {
    id: "admin",
    labelKey: "groups.admin",
    permissions: [PERMISSIONS.ADMIN_SETTINGS, PERMISSIONS.ACCESS_MANAGE],
  },
];

const OPS_TEMPLATE: readonly Permission[] = [
  PERMISSIONS.SCREEN_HOME,
  PERMISSIONS.SCREEN_WORK_ORDERS,
  PERMISSIONS.SCREEN_APPOINTMENTS,
  PERMISSIONS.WORK_ORDERS,
  PERMISSIONS.APPOINTMENTS,
  PERMISSIONS.VEHICLES,
  PERMISSIONS.PARTS_CATALOG,
  PERMISSIONS.TOOLS,
  PERMISSIONS.CALENDAR,
];

/** Seed packages. Advisor and technician keep the full workshop flow; settings and access go to the manager. */
export const ROLE_TEMPLATES: Record<RoleCode, readonly Permission[]> = {
  SERVICE_ADVISOR: expandEntityReads(OPS_TEMPLATE),
  TECHNICIAN: expandEntityReads(OPS_TEMPLATE),
  STO_MANAGER: ALL_PERMISSIONS,
  BUSINESS_OWNER: ALL_PERMISSIONS,
  PLATFORM_MEMBER: expandEntityReads(OPS_TEMPLATE),
  SATELLITE_OPERATOR: expandEntityReads(OPS_TEMPLATE),
};

export type AccessColumn = "view" | "change" | "operate" | "admin";

export const ENTITY_ACCESS_MATRIX: {
  id: string;
  cells: Partial<Record<AccessColumn, Permission[]>>;
}[] = [
  {
    id: "workOrder",
    cells: {
      view: [PERMISSIONS.WORK_ORDERS_READ, PERMISSIONS.SCREEN_WORK_ORDERS, PERMISSIONS.SCREEN_HOME],
      change: [PERMISSIONS.WORK_ORDERS],
    },
  },
  {
    id: "appointment",
    cells: {
      view: [PERMISSIONS.APPOINTMENTS_READ, PERMISSIONS.SCREEN_APPOINTMENTS],
      change: [PERMISSIONS.APPOINTMENTS],
    },
  },
  { id: "vehicle", cells: { view: [PERMISSIONS.VEHICLES_READ], change: [PERMISSIONS.VEHICLES] } },
  { id: "parts", cells: { view: [PERMISSIONS.PARTS_CATALOG_READ], change: [PERMISSIONS.PARTS_CATALOG] } },
  { id: "tool", cells: { view: [PERMISSIONS.TOOLS_READ], change: [PERMISSIONS.TOOLS] } },
  { id: "calendar", cells: { view: [PERMISSIONS.CALENDAR_READ], change: [PERMISSIONS.CALENDAR] } },
  {
    id: "access",
    cells: {
      view: [PERMISSIONS.SCREEN_ADMIN_ACCESS, PERMISSIONS.SCREEN_ADMIN_SETTINGS],
      admin: [PERMISSIONS.ADMIN_SETTINGS, PERMISSIONS.ACCESS_MANAGE],
    },
  },
];
