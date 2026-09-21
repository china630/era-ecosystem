/**
 * F&B Variant A permission catalog (catalogVersion 1).
 * Keys: api: / screen: / admin: only — role name grants nothing.
 */

export const PERMISSIONS = {
  // Screens
  SCREEN_HOME: "screen:home",
  SCREEN_FLOOR: "screen:floor",
  SCREEN_ORDERS: "screen:orders",
  SCREEN_KDS: "screen:kds",
  SCREEN_CALENDAR: "screen:calendar",
  SCREEN_EXECUTIVE: "screen:executive",
  SCREEN_ADMIN_MENU: "screen:admin.menu",
  SCREEN_ADMIN_TABLES: "screen:admin.tables",
  SCREEN_ADMIN_DAILY_MENU: "screen:admin.daily_menu",
  SCREEN_ADMIN_IMPORT: "screen:admin.import",
  SCREEN_ADMIN_SETTINGS: "screen:admin.settings",
  SCREEN_ADMIN_INTEGRATION: "screen:admin.integration",
  SCREEN_ADMIN_ACCESS: "screen:admin.access",
  SCREEN_ADMIN_ROSTER: "screen:admin.roster",

  // Admin
  ACCESS_MANAGE: "admin:access_manage",
  STAFF_PIN: "admin:staff_pin",
  OUTLET_BIND: "admin:outlet_bind",
  MASTER_DATA: "admin:master_data",

  // Tickets / till
  TICKETS_OPEN: "api:tickets.open",
  TICKETS_LINES: "api:tickets.lines",
  TICKETS_FIRE: "api:tickets.fire",
  TICKETS_SPLIT: "api:tickets.split",
  TICKETS_PAY: "api:tickets.pay",
  TICKETS_DISCOUNT: "api:tickets.discount",
  TICKETS_VOID: "api:tickets.void",
  TICKETS_OFFLINE_REPLAY: "api:tickets.offline_replay",

  // Hotel-only (edition gate ∩ grant)
  ROOM_CHARGE: "api:tickets.room_charge",
  DEFER_HUB: "api:tickets.defer_hub",
  ROOM_SERVICE: "api:tickets.room_service",
  RESERVATIONS_OPEN_TICKET: "api:reservations.open_ticket",
  PMS_ENTITLEMENTS: "api:pms.entitlements",

  KDS_BUMP: "api:kds.bump",
  MENU_SOLD_OUT: "api:menu.sold_out",
  MENU_MANAGE: "api:menu.manage",
  TABLES_MANAGE: "api:tables.manage",
  OUTLETS_MANAGE: "api:outlets.manage",
  SHIFTS_OPEN: "api:shifts.open",
  SHIFTS_CLOSE: "api:shifts.close",
  LABOR_ROSTER_READ: "api:labor.roster.read",
  LABOR_ROSTER_WRITE: "api:labor.roster.write",
  ADMIN_DAILY_MENU: "api:admin.daily_menu",
  ADMIN_INTEGRATION: "api:admin.integration",
  IMPORT_CUTOVER: "api:import.cutover",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLE_CODES = {
  WAITER: "FB_WAITER",
  CASHIER: "FB_CASHIER",
  KITCHEN: "FB_KITCHEN",
  MANAGER: "FB_MANAGER",
} as const;

export type RoleCode = (typeof ROLE_CODES)[keyof typeof ROLE_CODES];

export const ALL_PERMISSIONS = Object.values(PERMISSIONS);

export const SYSTEM_FNB_ROLES: RoleCode[] = [
  ROLE_CODES.WAITER,
  ROLE_CODES.CASHIER,
  ROLE_CODES.KITCHEN,
  ROLE_CODES.MANAGER,
];

export const SYSTEM_ROLE_NAMES: Record<RoleCode, string> = {
  [ROLE_CODES.WAITER]: "Waiter",
  [ROLE_CODES.CASHIER]: "Cashier",
  [ROLE_CODES.KITCHEN]: "Kitchen",
  [ROLE_CODES.MANAGER]: "Floor manager",
};

export function isSystemFnbRoleCode(code: string): code is RoleCode {
  return (SYSTEM_FNB_ROLES as string[]).includes(code);
}

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
      PERMISSIONS.SCREEN_FLOOR,
      PERMISSIONS.SCREEN_ORDERS,
      PERMISSIONS.SCREEN_KDS,
      PERMISSIONS.SCREEN_CALENDAR,
      PERMISSIONS.SCREEN_EXECUTIVE,
      PERMISSIONS.SCREEN_ADMIN_MENU,
      PERMISSIONS.SCREEN_ADMIN_TABLES,
      PERMISSIONS.SCREEN_ADMIN_DAILY_MENU,
      PERMISSIONS.SCREEN_ADMIN_IMPORT,
      PERMISSIONS.SCREEN_ADMIN_SETTINGS,
      PERMISSIONS.SCREEN_ADMIN_INTEGRATION,
      PERMISSIONS.SCREEN_ADMIN_ACCESS,
      PERMISSIONS.SCREEN_ADMIN_ROSTER,
    ],
  },
  {
    id: "till",
    labelKey: "groupTill",
    permissions: [
      PERMISSIONS.TICKETS_OPEN,
      PERMISSIONS.TICKETS_LINES,
      PERMISSIONS.TICKETS_FIRE,
      PERMISSIONS.TICKETS_SPLIT,
      PERMISSIONS.TICKETS_PAY,
      PERMISSIONS.TICKETS_DISCOUNT,
      PERMISSIONS.TICKETS_VOID,
      PERMISSIONS.TICKETS_OFFLINE_REPLAY,
      PERMISSIONS.MENU_SOLD_OUT,
      PERMISSIONS.SHIFTS_OPEN,
      PERMISSIONS.SHIFTS_CLOSE,
    ],
  },
  {
    id: "hotel",
    labelKey: "groupHotel",
    permissions: [
      PERMISSIONS.ROOM_CHARGE,
      PERMISSIONS.DEFER_HUB,
      PERMISSIONS.ROOM_SERVICE,
      PERMISSIONS.RESERVATIONS_OPEN_TICKET,
      PERMISSIONS.PMS_ENTITLEMENTS,
      PERMISSIONS.SCREEN_CALENDAR,
    ],
  },
  {
    id: "kds",
    labelKey: "groupKds",
    permissions: [PERMISSIONS.KDS_BUMP, PERMISSIONS.SCREEN_KDS],
  },
  {
    id: "admin",
    labelKey: "groupAdmin",
    permissions: [
      PERMISSIONS.MENU_MANAGE,
      PERMISSIONS.TABLES_MANAGE,
      PERMISSIONS.OUTLETS_MANAGE,
      PERMISSIONS.ADMIN_DAILY_MENU,
      PERMISSIONS.ADMIN_INTEGRATION,
      PERMISSIONS.IMPORT_CUTOVER,
      PERMISSIONS.LABOR_ROSTER_READ,
      PERMISSIONS.LABOR_ROSTER_WRITE,
      PERMISSIONS.ACCESS_MANAGE,
      PERMISSIONS.STAFF_PIN,
      PERMISSIONS.OUTLET_BIND,
      PERMISSIONS.MASTER_DATA,
    ],
  },
];

const TILL_BASE: Permission[] = [
  PERMISSIONS.SCREEN_HOME,
  PERMISSIONS.SCREEN_FLOOR,
  PERMISSIONS.SCREEN_ORDERS,
  PERMISSIONS.TICKETS_OPEN,
  PERMISSIONS.TICKETS_LINES,
  PERMISSIONS.TICKETS_FIRE,
  PERMISSIONS.TICKETS_OFFLINE_REPLAY,
  PERMISSIONS.MENU_SOLD_OUT,
  PERMISSIONS.SHIFTS_OPEN,
];

const HOTEL_TILL_EXTRA: Permission[] = [
  PERMISSIONS.SCREEN_CALENDAR,
  PERMISSIONS.ROOM_CHARGE,
  PERMISSIONS.DEFER_HUB,
  PERMISSIONS.ROOM_SERVICE,
  PERMISSIONS.RESERVATIONS_OPEN_TICKET,
  PERMISSIONS.PMS_ENTITLEMENTS,
];

/** Hotel-edition waiter may settle; Kafe waiter may not. */
export function waiterPermissions(edition: "hotel" | "kafe"): Permission[] {
  const base: Permission[] = [
    ...TILL_BASE,
    PERMISSIONS.TICKETS_SPLIT,
  ];
  if (edition === "hotel") {
    return [...base, PERMISSIONS.TICKETS_PAY, ...HOTEL_TILL_EXTRA];
  }
  return base;
}

export function cashierPermissions(edition: "hotel" | "kafe"): Permission[] {
  const base: Permission[] = [
    ...TILL_BASE,
    PERMISSIONS.TICKETS_PAY,
  ];
  if (edition === "hotel") {
    return [...base, ...HOTEL_TILL_EXTRA];
  }
  return base;
}

export function kitchenPermissions(): Permission[] {
  return [
    PERMISSIONS.SCREEN_HOME,
    PERMISSIONS.SCREEN_KDS,
    PERMISSIONS.KDS_BUMP,
  ];
}

export function managerPermissions(edition: "hotel" | "kafe"): Permission[] {
  const all = [...ALL_PERMISSIONS];
  if (edition === "kafe") {
    return all.filter(
      (p) =>
        p !== PERMISSIONS.ROOM_CHARGE &&
        p !== PERMISSIONS.DEFER_HUB &&
        p !== PERMISSIONS.ROOM_SERVICE &&
        p !== PERMISSIONS.RESERVATIONS_OPEN_TICKET &&
        p !== PERMISSIONS.PMS_ENTITLEMENTS &&
        p !== PERMISSIONS.SCREEN_CALENDAR,
    );
  }
  return all;
}

export type FnbEdition = "hotel" | "kafe";

export function rolePermissionsForEdition(
  roleCode: string,
  edition: FnbEdition,
): Permission[] {
  switch (roleCode) {
    case ROLE_CODES.WAITER:
      return waiterPermissions(edition);
    case ROLE_CODES.CASHIER:
      return cashierPermissions(edition);
    case ROLE_CODES.KITCHEN:
      return kitchenPermissions();
    case ROLE_CODES.MANAGER:
      return managerPermissions(edition);
    default:
      return [];
  }
}

/** Template for ensure — defaults to hotel until profile is known. */
export function permissionsForRole(roleCode: string): Permission[] {
  return rolePermissionsForEdition(roleCode, "hotel");
}

export function serializePermissions(perms: Permission[]): string {
  const seen = new Set<string>();
  const out: Permission[] = [];
  for (const p of perms) {
    if (isFnbPermission(p) && !seen.has(p)) {
      seen.add(p);
      out.push(p);
    }
  }
  return JSON.stringify(out);
}

export function isFnbPermission(value: string): value is Permission {
  return (ALL_PERMISSIONS as string[]).includes(value);
}

export function parsePermissions(json: string): Permission[] {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(String).filter(isFnbPermission);
  } catch {
    return [];
  }
}

export function coerceFnbPermission(raw: string): Permission | null {
  return isFnbPermission(raw) ? raw : null;
}

export function effectiveRolePermissions(
  roleCode: string,
  permissionsJson: string,
  edition: FnbEdition = "hotel",
): Permission[] {
  try {
    const parsed = JSON.parse(permissionsJson) as unknown;
    if (Array.isArray(parsed)) {
      return parsePermissions(permissionsJson);
    }
  } catch {
    // fall through
  }
  return rolePermissionsForEdition(roleCode, edition);
}

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

/** CP / pinRole aliases → system FB_* codes. */
export const FNB_ROLE_ALIASES: Record<string, RoleCode> = {
  WAITER: ROLE_CODES.WAITER,
  FB_WAITER: ROLE_CODES.WAITER,
  CASHIER: ROLE_CODES.CASHIER,
  FB_CASHIER: ROLE_CODES.CASHIER,
  CHEF: ROLE_CODES.KITCHEN,
  KITCHEN: ROLE_CODES.KITCHEN,
  FB_KITCHEN: ROLE_CODES.KITCHEN,
  MANAGER: ROLE_CODES.MANAGER,
  FB_MANAGER: ROLE_CODES.MANAGER,
  STAFF: ROLE_CODES.WAITER,
};

export function resolveFnbRoleCode(raw: string): RoleCode | null {
  const key = raw.trim().toUpperCase();
  return FNB_ROLE_ALIASES[key] ?? (isSystemFnbRoleCode(raw) ? raw : null);
}

/** pinRole enum on StaffRoster → Role.code */
export const PIN_ROLE_TO_CODE: Record<string, RoleCode> = {
  CASHIER: ROLE_CODES.CASHIER,
  WAITER: ROLE_CODES.WAITER,
  KITCHEN: ROLE_CODES.KITCHEN,
  MANAGER: ROLE_CODES.MANAGER,
};

export function pinRoleToCode(pinRole: string): RoleCode {
  return PIN_ROLE_TO_CODE[pinRole] ?? ROLE_CODES.CASHIER;
}

export function roleCodeToPinRole(code: RoleCode): string {
  switch (code) {
    case ROLE_CODES.WAITER:
      return "WAITER";
    case ROLE_CODES.CASHIER:
      return "CASHIER";
    case ROLE_CODES.KITCHEN:
      return "KITCHEN";
    case ROLE_CODES.MANAGER:
      return "MANAGER";
  }
}
