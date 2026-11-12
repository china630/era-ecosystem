/**
 * CRM domain permission catalog (CRM-RBAC-01, Variant A).
 * A role is a package of grants; a door checks a grant, never a role name.
 * Edge-safe: no Prisma, no Node crypto.
 */

export const PERMISSIONS = {
  SCREEN_HOME: "screen:home",
  SCREEN_LEADS: "screen:leads",
  SCREEN_LEADS_DETAIL: "screen:leads.detail",
  SCREEN_INBOX: "screen:inbox",
  SCREEN_VISITS: "screen:visits",
  SCREEN_ADMIN_ACCESS: "screen:admin.access",

  LEADS_READ: "api:leads.read",
  LEADS_WRITE: "api:leads.write",
  LEADS_STAGE: "api:leads.stage",
  LEADS_CONVERT: "api:leads.convert",
  LEADS_FOLLOW_UP: "api:leads.follow_up",
  LEADS_ASSIGN: "api:leads.assign",
  INBOX: "api:inbox",
  INBOX_READ: "api:inbox.read",
  VISITS: "api:visits",
  VISITS_READ: "api:visits.read",
  LOOKUPS: "api:lookups",
  LOOKUPS_READ: "api:lookups.read",
  USERS_LIST: "api:users.list",

  ADMIN_IMPORT: "admin:import",
  ADMIN_PIPELINE: "admin:pipeline",
  ACCESS_MANAGE: "admin:access_manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: readonly Permission[] = Object.values(PERMISSIONS);

export const ROLE_CODES = {
  SALES_AGENT: "SALES_AGENT",
  SALES_LEAD: "SALES_LEAD",
  FIELD_REP: "FIELD_REP",
  BUSINESS_OWNER: "BUSINESS_OWNER",
  PLATFORM_MEMBER: "PLATFORM_MEMBER",
  SATELLITE_OPERATOR: "SATELLITE_OPERATOR",
} as const;

export type RoleCode = (typeof ROLE_CODES)[keyof typeof ROLE_CODES];

export const SYSTEM_ROLE_CODES: readonly RoleCode[] = Object.values(ROLE_CODES);

export const SYSTEM_ROLE_NAMES: Record<RoleCode, string> = {
  SALES_AGENT: "Sales agent",
  SALES_LEAD: "Sales lead",
  FIELD_REP: "Field rep",
  BUSINESS_OWNER: "Business Owner",
  PLATFORM_MEMBER: "Platform Member",
  SATELLITE_OPERATOR: "Satellite Operator",
};

/** Holds `admin:access_manage` by default. Does not bypass grants. */
export const ACCESS_MANAGER_ROLE: RoleCode = ROLE_CODES.SALES_LEAD;

/** Template for a legacy role code that is neither a system code nor an alias. */
export const LEGACY_FALLBACK_ROLE: RoleCode = ROLE_CODES.SALES_AGENT;

/** Pre-matrix role codes mapped to the system package that reproduces their access. */
export const ROLE_ALIASES: Record<string, RoleCode> = {
  ADMIN: ROLE_CODES.SALES_LEAD,
  MANAGER: ROLE_CODES.SALES_LEAD,
  SALES_MANAGER: ROLE_CODES.SALES_LEAD,
  OWNER: ROLE_CODES.SALES_LEAD,
  DIRECTOR: ROLE_CODES.SALES_LEAD,
  AGENT: ROLE_CODES.SALES_AGENT,
  SALES_REP: ROLE_CODES.SALES_AGENT,
  REP: ROLE_CODES.FIELD_REP,
};

export const PERMISSION_CATALOG_VERSION = 2;

export const READ_OF_WRITE: Readonly<Record<string, Permission>> = {
  [PERMISSIONS.INBOX]: PERMISSIONS.INBOX_READ,
  [PERMISSIONS.VISITS]: PERMISSIONS.VISITS_READ,
  [PERMISSIONS.LOOKUPS]: PERMISSIONS.LOOKUPS_READ,
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
      PERMISSIONS.SCREEN_LEADS,
      PERMISSIONS.SCREEN_LEADS_DETAIL,
      PERMISSIONS.SCREEN_INBOX,
      PERMISSIONS.SCREEN_VISITS,
      PERMISSIONS.SCREEN_ADMIN_ACCESS,
    ],
  },
  {
    id: "leads",
    labelKey: "groups.leads",
    permissions: [
      PERMISSIONS.LEADS_READ,
      PERMISSIONS.LEADS_WRITE,
      PERMISSIONS.LEADS_STAGE,
      PERMISSIONS.LEADS_CONVERT,
      PERMISSIONS.LEADS_FOLLOW_UP,
      PERMISSIONS.LEADS_ASSIGN,
    ],
  },
  {
    id: "field",
    labelKey: "groups.field",
    permissions: [PERMISSIONS.INBOX, PERMISSIONS.INBOX_READ, PERMISSIONS.VISITS, PERMISSIONS.VISITS_READ, PERMISSIONS.LOOKUPS, PERMISSIONS.LOOKUPS_READ, PERMISSIONS.USERS_LIST],
  },
  {
    id: "admin",
    labelKey: "groups.admin",
    permissions: [PERMISSIONS.ADMIN_IMPORT, PERMISSIONS.ADMIN_PIPELINE, PERMISSIONS.ACCESS_MANAGE],
  },
];

const AGENT_TEMPLATE: readonly Permission[] = [
  PERMISSIONS.SCREEN_HOME,
  PERMISSIONS.SCREEN_LEADS,
  PERMISSIONS.SCREEN_LEADS_DETAIL,
  PERMISSIONS.SCREEN_INBOX,
  PERMISSIONS.SCREEN_VISITS,
  PERMISSIONS.LEADS_READ,
  PERMISSIONS.LEADS_WRITE,
  PERMISSIONS.LEADS_STAGE,
  PERMISSIONS.LEADS_CONVERT,
  PERMISSIONS.LEADS_FOLLOW_UP,
  PERMISSIONS.INBOX,
  PERMISSIONS.VISITS,
  PERMISSIONS.LOOKUPS,
  PERMISSIONS.USERS_LIST,
];

/** Seed packages. Only the sales lead (and owner bypass) assigns leads, imports, and edits pipeline rules. */
export const ROLE_TEMPLATES: Record<RoleCode, readonly Permission[]> = {
  SALES_AGENT: expandEntityReads(AGENT_TEMPLATE),
  SALES_LEAD: ALL_PERMISSIONS,
  FIELD_REP: expandEntityReads(AGENT_TEMPLATE),
  BUSINESS_OWNER: ALL_PERMISSIONS,
  PLATFORM_MEMBER: expandEntityReads(AGENT_TEMPLATE),
  SATELLITE_OPERATOR: expandEntityReads(AGENT_TEMPLATE),
};

export type AccessColumn = "view" | "change" | "operate" | "admin";

export const ENTITY_ACCESS_MATRIX: {
  id: string;
  cells: Partial<Record<AccessColumn, Permission[]>>;
}[] = [
  {
    id: "lead",
    cells: {
      view: [PERMISSIONS.LEADS_READ, PERMISSIONS.SCREEN_LEADS, PERMISSIONS.SCREEN_LEADS_DETAIL, PERMISSIONS.SCREEN_HOME],
      change: [PERMISSIONS.LEADS_WRITE],
      operate: [PERMISSIONS.LEADS_STAGE, PERMISSIONS.LEADS_CONVERT, PERMISSIONS.LEADS_FOLLOW_UP, PERMISSIONS.LEADS_ASSIGN],
    },
  },
  { id: "inbox", cells: { view: [PERMISSIONS.INBOX_READ, PERMISSIONS.SCREEN_INBOX], change: [PERMISSIONS.INBOX] } },
  { id: "visit", cells: { view: [PERMISSIONS.VISITS_READ, PERMISSIONS.SCREEN_VISITS], change: [PERMISSIONS.VISITS] } },
  { id: "lookup", cells: { view: [PERMISSIONS.LOOKUPS_READ], change: [PERMISSIONS.LOOKUPS] } },
  { id: "users", cells: { view: [PERMISSIONS.USERS_LIST] } },
  { id: "pipeline", cells: { admin: [PERMISSIONS.ADMIN_PIPELINE, PERMISSIONS.ADMIN_IMPORT] } },
  { id: "access", cells: { view: [PERMISSIONS.SCREEN_ADMIN_ACCESS], admin: [PERMISSIONS.ACCESS_MANAGE] } },
];
