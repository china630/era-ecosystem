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
  BOQ: "api:boq",
  DAILY_LOGS: "api:daily_logs",
  PUNCH_LIST: "api:punch_list",
  GANTT: "api:gantt",
  REQUISITIONS: "api:requisitions",
  ACTS_APPROVE: "api:acts.approve",
  TIMESHEETS_IMPORT: "api:timesheets.import",
  EQUIPMENT_HOURS: "api:equipment.hours",
  CDE: "api:cde",
  SUBCONTRACTOR_CLAIMS: "api:subcontractor_claims",

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
      PERMISSIONS.BOQ,
      PERMISSIONS.GANTT,
      PERMISSIONS.ACTS_APPROVE,
      PERMISSIONS.SUBCONTRACTOR_CLAIMS,
      PERMISSIONS.CDE,
    ],
  },
  {
    id: "site",
    labelKey: "groups.site",
    permissions: [
      PERMISSIONS.DAILY_LOGS,
      PERMISSIONS.PUNCH_LIST,
      PERMISSIONS.REQUISITIONS,
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
  SITE_MANAGER: OPS_TEMPLATE,
  ESTIMATOR: OPS_TEMPLATE,
  PROJECT_MANAGER: ALL_PERMISSIONS,
  BUSINESS_OWNER: ALL_PERMISSIONS,
  PLATFORM_MEMBER: OPS_TEMPLATE,
  SATELLITE_OPERATOR: OPS_TEMPLATE,
};
