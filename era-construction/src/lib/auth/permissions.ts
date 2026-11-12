/**
 * Construction domain permission catalog (CN-RBAC-01, Variant A).
 * A role is a package of grants; a door checks a grant, never a role name.
 * Edge-safe: no Prisma, no Node crypto.
 */

export const PERMISSIONS = {
  SCREEN_HOME: "screen:home",
  SCREEN_PROJECTS: "screen:projects",
  SCREEN_PROJECTS_DETAIL: "screen:projects.detail",
  SCREEN_FIELD_OPS: "screen:field_ops",
  SCREEN_MATERIAL_REQUISITIONS: "screen:material_requisitions",
  SCREEN_ADMIN_SETTINGS: "screen:admin.settings",
  SCREEN_ADMIN_ACCESS: "screen:admin.access",

  PROJECTS: "api:projects",
  PROJECTS_READ: "api:projects.read",
  BOQ: "api:boq",
  BOQ_READ: "api:boq.read",
  DAILY_LOGS: "api:daily_logs",
  DAILY_LOGS_READ: "api:daily_logs.read",
  PUNCH_LIST: "api:punch_list",
  PUNCH_LIST_READ: "api:punch_list.read",
  GANTT: "api:gantt",
  GANTT_READ: "api:gantt.read",
  REQUISITIONS: "api:requisitions",
  REQUISITIONS_READ: "api:requisitions.read",
  CDE: "api:cde",
  CDE_READ: "api:cde.read",
  SUBCONTRACTOR_CLAIMS: "api:subcontractor_claims",
  SUBCONTRACTOR_CLAIMS_READ: "api:subcontractor_claims.read",
  ACTS_APPROVE: "api:acts.approve",
  TIMESHEETS_IMPORT: "api:timesheets.import",
  EQUIPMENT_HOURS: "api:equipment.hours",

  ACCESS_MANAGE: "admin:access_manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: readonly Permission[] = Object.values(PERMISSIONS);

export const ROLE_CODES = {
  SITE_MANAGER: "SITE_MANAGER",
  ESTIMATOR: "ESTIMATOR",
  PROJECT_MANAGER: "PROJECT_MANAGER",
  BUSINESS_OWNER: "BUSINESS_OWNER",
  PLATFORM_MEMBER: "PLATFORM_MEMBER",
  SATELLITE_OPERATOR: "SATELLITE_OPERATOR",
} as const;

export type RoleCode = (typeof ROLE_CODES)[keyof typeof ROLE_CODES];

export const SYSTEM_ROLE_CODES: readonly RoleCode[] = Object.values(ROLE_CODES);

export const SYSTEM_ROLE_NAMES: Record<RoleCode, string> = {
  SITE_MANAGER: "Site manager",
  ESTIMATOR: "Estimator",
  PROJECT_MANAGER: "Project manager",
  BUSINESS_OWNER: "Business Owner",
  PLATFORM_MEMBER: "Platform Member",
  SATELLITE_OPERATOR: "Satellite Operator",
};

/** Holds `admin:access_manage` by default. Does not bypass grants. */
export const ACCESS_MANAGER_ROLE: RoleCode = ROLE_CODES.PROJECT_MANAGER;

/** Template for a legacy role code that is neither a system code nor an alias. */
export const LEGACY_FALLBACK_ROLE: RoleCode = ROLE_CODES.SITE_MANAGER;

/** Pre-matrix role codes mapped to the system package that reproduces their access. */
export const ROLE_ALIASES: Record<string, RoleCode> = {
  ADMIN: ROLE_CODES.PROJECT_MANAGER,
  MANAGER: ROLE_CODES.PROJECT_MANAGER,
  OWNER: ROLE_CODES.PROJECT_MANAGER,
  DIRECTOR: ROLE_CODES.PROJECT_MANAGER,
  CHIEF_ENGINEER: ROLE_CODES.PROJECT_MANAGER,
  FOREMAN: ROLE_CODES.SITE_MANAGER,
  QS: ROLE_CODES.ESTIMATOR,
};

export const PERMISSION_CATALOG_VERSION = 2;

export const READ_OF_WRITE: Readonly<Record<string, Permission>> = {
  [PERMISSIONS.PROJECTS]: PERMISSIONS.PROJECTS_READ,
  [PERMISSIONS.BOQ]: PERMISSIONS.BOQ_READ,
  [PERMISSIONS.DAILY_LOGS]: PERMISSIONS.DAILY_LOGS_READ,
  [PERMISSIONS.PUNCH_LIST]: PERMISSIONS.PUNCH_LIST_READ,
  [PERMISSIONS.GANTT]: PERMISSIONS.GANTT_READ,
  [PERMISSIONS.REQUISITIONS]: PERMISSIONS.REQUISITIONS_READ,
  [PERMISSIONS.CDE]: PERMISSIONS.CDE_READ,
  [PERMISSIONS.SUBCONTRACTOR_CLAIMS]: PERMISSIONS.SUBCONTRACTOR_CLAIMS_READ,
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
      PERMISSIONS.SCREEN_PROJECTS,
      PERMISSIONS.SCREEN_PROJECTS_DETAIL,
      PERMISSIONS.SCREEN_FIELD_OPS,
      PERMISSIONS.SCREEN_MATERIAL_REQUISITIONS,
      PERMISSIONS.SCREEN_ADMIN_SETTINGS,
      PERMISSIONS.SCREEN_ADMIN_ACCESS,
    ],
  },
  {
    id: "projects",
    labelKey: "groups.projects",
    permissions: [
      PERMISSIONS.PROJECTS,
      PERMISSIONS.PROJECTS_READ,
      PERMISSIONS.BOQ,
      PERMISSIONS.BOQ_READ,
      PERMISSIONS.GANTT,
      PERMISSIONS.GANTT_READ,
      PERMISSIONS.ACTS_APPROVE,
      PERMISSIONS.SUBCONTRACTOR_CLAIMS,
      PERMISSIONS.SUBCONTRACTOR_CLAIMS_READ,
      PERMISSIONS.CDE,
      PERMISSIONS.CDE_READ,
    ],
  },
  {
    id: "site",
    labelKey: "groups.site",
    permissions: [
      PERMISSIONS.DAILY_LOGS,
      PERMISSIONS.DAILY_LOGS_READ,
      PERMISSIONS.PUNCH_LIST,
      PERMISSIONS.PUNCH_LIST_READ,
      PERMISSIONS.REQUISITIONS,
      PERMISSIONS.REQUISITIONS_READ,
      PERMISSIONS.TIMESHEETS_IMPORT,
      PERMISSIONS.EQUIPMENT_HOURS,
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
  PERMISSIONS.SCREEN_PROJECTS,
  PERMISSIONS.SCREEN_PROJECTS_DETAIL,
  PERMISSIONS.SCREEN_FIELD_OPS,
  PERMISSIONS.SCREEN_MATERIAL_REQUISITIONS,
  PERMISSIONS.PROJECTS,
  PERMISSIONS.BOQ,
  PERMISSIONS.DAILY_LOGS,
  PERMISSIONS.PUNCH_LIST,
  PERMISSIONS.GANTT,
  PERMISSIONS.REQUISITIONS,
  PERMISSIONS.ACTS_APPROVE,
  PERMISSIONS.TIMESHEETS_IMPORT,
  PERMISSIONS.EQUIPMENT_HOURS,
  PERMISSIONS.CDE,
  PERMISSIONS.SUBCONTRACTOR_CLAIMS,
];

/** Seed packages. Every ops role keeps the full project and site flow, act approve included; settings and access go to the manager. */
export const ROLE_TEMPLATES: Record<RoleCode, readonly Permission[]> = {
  SITE_MANAGER: expandEntityReads(OPS_TEMPLATE),
  ESTIMATOR: expandEntityReads(OPS_TEMPLATE),
  PROJECT_MANAGER: ALL_PERMISSIONS,
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
    id: "project",
    cells: {
      view: [PERMISSIONS.PROJECTS_READ, PERMISSIONS.SCREEN_PROJECTS, PERMISSIONS.SCREEN_PROJECTS_DETAIL, PERMISSIONS.SCREEN_HOME],
      change: [PERMISSIONS.PROJECTS],
    },
  },
  { id: "boq", cells: { view: [PERMISSIONS.BOQ_READ], change: [PERMISSIONS.BOQ] } },
  {
    id: "dailyLog",
    cells: {
      view: [PERMISSIONS.DAILY_LOGS_READ, PERMISSIONS.SCREEN_FIELD_OPS],
      change: [PERMISSIONS.DAILY_LOGS],
    },
  },
  { id: "punch", cells: { view: [PERMISSIONS.PUNCH_LIST_READ], change: [PERMISSIONS.PUNCH_LIST] } },
  { id: "gantt", cells: { view: [PERMISSIONS.GANTT_READ], change: [PERMISSIONS.GANTT] } },
  {
    id: "requisition",
    cells: {
      view: [PERMISSIONS.REQUISITIONS_READ, PERMISSIONS.SCREEN_MATERIAL_REQUISITIONS],
      change: [PERMISSIONS.REQUISITIONS],
    },
  },
  { id: "act", cells: { operate: [PERMISSIONS.ACTS_APPROVE] } },
  { id: "labor", cells: { operate: [PERMISSIONS.TIMESHEETS_IMPORT, PERMISSIONS.EQUIPMENT_HOURS] } },
  { id: "cde", cells: { view: [PERMISSIONS.CDE_READ], change: [PERMISSIONS.CDE] } },
  {
    id: "claim",
    cells: { view: [PERMISSIONS.SUBCONTRACTOR_CLAIMS_READ], change: [PERMISSIONS.SUBCONTRACTOR_CLAIMS] },
  },
  {
    id: "access",
    cells: {
      view: [PERMISSIONS.SCREEN_ADMIN_ACCESS, PERMISSIONS.SCREEN_ADMIN_SETTINGS],
      admin: [PERMISSIONS.ACCESS_MANAGE],
    },
  },
];
