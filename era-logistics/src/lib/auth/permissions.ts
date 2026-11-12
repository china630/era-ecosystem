/**
 * Logistics domain permission catalog (LOG-RBAC-01, Variant A).
 * A role is a package of grants; a door checks a grant, never a role name.
 * Edge-safe: no Prisma, no Node crypto.
 */

export const PERMISSIONS = {
  SCREEN_HOME: "screen:home",
  SCREEN_TRIPS: "screen:trips",
  SCREEN_TRIPS_DETAIL: "screen:trips.detail",
  SCREEN_FLEET: "screen:fleet",
  SCREEN_CUSTOMS: "screen:customs",
  SCREEN_REPORTS_FUEL: "screen:reports.fuel",
  SCREEN_ADMIN_SETTINGS: "screen:admin.settings",
  SCREEN_ADMIN_ACCESS: "screen:admin.access",

  TRIPS: "api:trips",
  TRIPS_READ: "api:trips.read",
  TRIPS_WAYBILL: "api:trips.waybill",
  TRIPS_POD: "api:trips.pod",
  TRIPS_COMPLETE: "api:trips.complete",
  TRIPS_POINTS: "api:trips.points",
  DRIVER_TRIPS: "api:driver.trips",
  FLEET_ALERTS: "api:fleet.alerts",
  HUB_SCAN: "api:hub.scan",
  COD_SETTLE: "api:cod.settle",
  REPORTS_FUEL: "api:reports.fuel",
  CUSTOMS_PREVIEW: "api:customs.preview",

  ACCESS_MANAGE: "admin:access_manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: readonly Permission[] = Object.values(PERMISSIONS);

export const ROLE_CODES = {
  DISPATCHER: "DISPATCHER",
  DRIVER: "DRIVER",
  BUSINESS_OWNER: "BUSINESS_OWNER",
  PLATFORM_MEMBER: "PLATFORM_MEMBER",
  SATELLITE_OPERATOR: "SATELLITE_OPERATOR",
} as const;

export type RoleCode = (typeof ROLE_CODES)[keyof typeof ROLE_CODES];

export const SYSTEM_ROLE_CODES: readonly RoleCode[] = Object.values(ROLE_CODES);

export const SYSTEM_ROLE_NAMES: Record<RoleCode, string> = {
  DISPATCHER: "Dispatcher",
  DRIVER: "Driver",
  BUSINESS_OWNER: "Business Owner",
  PLATFORM_MEMBER: "Platform Member",
  SATELLITE_OPERATOR: "Satellite Operator",
};

/** Holds `admin:access_manage` by default. Does not bypass grants. */
export const ACCESS_MANAGER_ROLE: RoleCode = ROLE_CODES.DISPATCHER;

/** Template for a legacy role code that is neither a system code nor an alias. */
export const LEGACY_FALLBACK_ROLE: RoleCode = ROLE_CODES.DRIVER;

/** Pre-matrix role codes mapped to the system package that reproduces their access. */
export const ROLE_ALIASES: Record<string, RoleCode> = {
  ADMIN: ROLE_CODES.DISPATCHER,
  MANAGER: ROLE_CODES.DISPATCHER,
  OWNER: ROLE_CODES.DISPATCHER,
  DIRECTOR: ROLE_CODES.DISPATCHER,
  LOGISTICS_MANAGER: ROLE_CODES.DISPATCHER,
  COURIER: ROLE_CODES.DRIVER,
};

export const PERMISSION_CATALOG_VERSION = 2;

export const READ_OF_WRITE: Readonly<Record<string, Permission>> = {
  [PERMISSIONS.TRIPS]: PERMISSIONS.TRIPS_READ,
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
      PERMISSIONS.SCREEN_TRIPS,
      PERMISSIONS.SCREEN_TRIPS_DETAIL,
      PERMISSIONS.SCREEN_FLEET,
      PERMISSIONS.SCREEN_CUSTOMS,
      PERMISSIONS.SCREEN_REPORTS_FUEL,
      PERMISSIONS.SCREEN_ADMIN_SETTINGS,
      PERMISSIONS.SCREEN_ADMIN_ACCESS,
    ],
  },
  {
    id: "trips",
    labelKey: "groups.trips",
    permissions: [
      PERMISSIONS.TRIPS,
      PERMISSIONS.TRIPS_READ,
      PERMISSIONS.TRIPS_WAYBILL,
      PERMISSIONS.TRIPS_POD,
      PERMISSIONS.TRIPS_COMPLETE,
      PERMISSIONS.TRIPS_POINTS,
      PERMISSIONS.DRIVER_TRIPS,
    ],
  },
  {
    id: "operations",
    labelKey: "groups.operations",
    permissions: [
      PERMISSIONS.FLEET_ALERTS,
      PERMISSIONS.HUB_SCAN,
      PERMISSIONS.COD_SETTLE,
      PERMISSIONS.REPORTS_FUEL,
      PERMISSIONS.CUSTOMS_PREVIEW,
    ],
  },
  {
    id: "admin",
    labelKey: "groups.admin",
    permissions: [PERMISSIONS.ACCESS_MANAGE],
  },
];

const OPS_TEMPLATE: readonly Permission[] = [
  PERMISSIONS.SCREEN_HOME,
  PERMISSIONS.SCREEN_TRIPS,
  PERMISSIONS.SCREEN_TRIPS_DETAIL,
  PERMISSIONS.SCREEN_FLEET,
  PERMISSIONS.SCREEN_CUSTOMS,
  PERMISSIONS.SCREEN_REPORTS_FUEL,
  PERMISSIONS.TRIPS,
  PERMISSIONS.TRIPS_WAYBILL,
  PERMISSIONS.TRIPS_POD,
  PERMISSIONS.TRIPS_COMPLETE,
  PERMISSIONS.TRIPS_POINTS,
  PERMISSIONS.DRIVER_TRIPS,
  PERMISSIONS.FLEET_ALERTS,
  PERMISSIONS.HUB_SCAN,
  PERMISSIONS.COD_SETTLE,
  PERMISSIONS.REPORTS_FUEL,
  PERMISSIONS.CUSTOMS_PREVIEW,
];

/** Seed packages. Driver and dispatcher keep the same trip flow (the PRD split is not enforced today); settings and access go to the dispatcher. */
export const ROLE_TEMPLATES: Record<RoleCode, readonly Permission[]> = {
  DISPATCHER: ALL_PERMISSIONS,
  DRIVER: expandEntityReads(OPS_TEMPLATE),
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
    id: "trip",
    cells: {
      view: [PERMISSIONS.TRIPS_READ, PERMISSIONS.SCREEN_TRIPS, PERMISSIONS.SCREEN_TRIPS_DETAIL, PERMISSIONS.SCREEN_HOME],
      change: [PERMISSIONS.TRIPS],
      operate: [PERMISSIONS.TRIPS_WAYBILL, PERMISSIONS.TRIPS_POD, PERMISSIONS.TRIPS_COMPLETE, PERMISSIONS.TRIPS_POINTS],
    },
  },
  { id: "driver", cells: { view: [PERMISSIONS.DRIVER_TRIPS] } },
  { id: "fleet", cells: { view: [PERMISSIONS.FLEET_ALERTS, PERMISSIONS.SCREEN_FLEET], operate: [PERMISSIONS.HUB_SCAN] } },
  { id: "customs", cells: { view: [PERMISSIONS.CUSTOMS_PREVIEW, PERMISSIONS.SCREEN_CUSTOMS] } },
  { id: "fuel", cells: { view: [PERMISSIONS.REPORTS_FUEL, PERMISSIONS.SCREEN_REPORTS_FUEL] } },
  { id: "cod", cells: { operate: [PERMISSIONS.COD_SETTLE] } },
  {
    id: "access",
    cells: {
      view: [PERMISSIONS.SCREEN_ADMIN_ACCESS, PERMISSIONS.SCREEN_ADMIN_SETTINGS],
      admin: [PERMISSIONS.ACCESS_MANAGE],
    },
  },
];
