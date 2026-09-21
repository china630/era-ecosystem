/**
 * Control-plane permission catalog (Wave 4/5 Variant A).
 * Canon: api: / screen: / admin: — shared by orchestrator + finance.
 * No Prisma dependency — role codes are string literals matching UserRole.
 */

export const CP_SYSTEM_ROLE_CODES = [
  "OWNER",
  "ADMIN",
  "ACCOUNTANT",
  "USER",
  "PROCUREMENT",
  "AUDITOR",
  "WAREHOUSE_KEEPER",
  "HR_OFFICER",
  "HR_MANAGER",
  "DEPARTMENT_HEAD",
  "DIRECTOR",
  "PARTNER",
] as const;

export type CpSystemRoleCode = (typeof CP_SYSTEM_ROLE_CODES)[number];

export const CP_PERMISSION = {
  // Org / team
  API_ORG_MEMBERS_READ: "api:org.members.read",
  API_ORG_MEMBERS_WRITE: "api:org.members.write",
  API_ORG_INVITES: "api:org.invites",
  API_ORG_TRANSFER_OWNERSHIP: "api:org.transfer_ownership",
  API_ORG_DEPARTMENTS: "api:org.departments",
  // Billing (CP SaaS)
  API_BILLING_READ: "api:billing.read",
  API_BILLING_MANAGE: "api:billing.manage",
  API_BILLING_PAYMENT_METHOD: "api:billing.payment_method",
  // Workforce
  API_WORKFORCE_READ: "api:workforce.read",
  API_WORKFORCE_HIRE: "api:workforce.hire",
  API_WORKFORCE_TERMINATE: "api:workforce.terminate",
  API_WORKFORCE_REPROVISION: "api:workforce.reprovision",
  API_WORKFORCE_SECURITY: "api:workforce.security",
  API_WORKFORCE_TIMESHEET: "api:workforce.timesheet",
  API_WORKFORCE_ABSENCES: "api:workforce.absences",
  API_WORKFORCE_ORG: "api:workforce.org",
  /** Owner-only scope bootstrap / commercial-link bind (locked). */
  API_WORKFORCE_BOOTSTRAP: "api:workforce.bootstrap",
  API_WORKFORCE_DOCS: "api:workforce.docs",
  API_WORKFORCE_ROSTER: "api:workforce.roster",
  API_WORKFORCE_ATTENDANCE: "api:workforce.attendance",
  API_WORKFORCE_IMPORT: "api:workforce.import",
  API_WORKFORCE_EXPORT: "api:workforce.export",
  API_WORKFORCE_POSITIONS: "api:workforce.positions",
  API_WORKFORCE_SEATS: "api:workforce.seats",
  API_WORKFORCE_HOLDING: "api:workforce.holding",
  API_WORKFORCE_ROLE_TEMPLATES: "api:workforce.role_templates",
  API_WORKFORCE_MANUAL_GRANTS: "api:workforce.manual_grants",
  API_WORKFORCE_VACATION: "api:workforce.vacation",
  // Workspace screens
  SCREEN_WORKSPACE_HOME: "screen:workspace.home",
  SCREEN_WORKSPACE_WORKFORCE: "screen:workspace.workforce",
  SCREEN_SETTINGS_TEAM: "screen:settings.team",
  SCREEN_SETTINGS_ACCESS: "screen:settings.access",
  SCREEN_HOLDINGS: "screen:holdings",
  SCREEN_BILLING: "screen:billing",
  // Access matrix manage
  ADMIN_ACCESS_MANAGE: "admin:access_manage",
  // Platform SA (locked — JWT only via isSuperAdmin bypass)
  ADMIN_PLATFORM: "admin:platform",
  // Finance org settings (extra-fields, org config)
  ADMIN_ORG_SETTINGS: "admin:org.settings",
  // Finance-facing
  API_LEDGER_POST: "api:ledger.post",
  API_LEDGER_READ: "api:ledger.read",
  API_LEDGER_PERIOD_CLOSE: "api:ledger.period_close",
  API_INVOICES_CREATE: "api:invoices.create",
  API_INVOICES_UPDATE: "api:invoices.update",
  API_PURCHASES_MANAGE: "api:purchases.manage",
  API_PAYROLL_MONEY: "api:payroll.money",
  API_PAYROLL_HR_CARD: "api:payroll.hr_card",
  API_INVENTORY_APPROVE: "api:inventory.approve",
  API_PSA_MANAGE: "api:psa.manage",
  API_REPORTS_NAS: "api:reports.nas",
  API_BOOK_MGMT: "api:book.mgmt",
} as const;

export type CpPermission = (typeof CP_PERMISSION)[keyof typeof CP_PERMISSION];

export const ALL_CP_PERMISSIONS: CpPermission[] = Object.values(CP_PERMISSION);

/** Cannot be granted via access UI to ADMIN/custom — OWNER via isOwner bypass. */
export const LOCKED_CP_PERMISSIONS: readonly CpPermission[] = [
  CP_PERMISSION.API_ORG_TRANSFER_OWNERSHIP,
  CP_PERMISSION.API_BILLING_PAYMENT_METHOD,
  CP_PERMISSION.API_WORKFORCE_BOOTSTRAP,
  CP_PERMISSION.ADMIN_PLATFORM,
];

const LOCKED_SET = new Set<string>(LOCKED_CP_PERMISSIONS);

export function isLockedCpPermission(code: string): boolean {
  return LOCKED_SET.has(code);
}

const PERMISSION_SET = new Set<string>(ALL_CP_PERMISSIONS);

export function isCpPermission(value: string): value is CpPermission {
  return PERMISSION_SET.has(value);
}

export type CpPermissionGroupId =
  | "org"
  | "billing"
  | "workforce"
  | "screens"
  | "admin"
  | "finance";

export type CpPermissionGroup = {
  id: CpPermissionGroupId;
  labelKey: string;
  permissions: CpPermission[];
};

export const CP_PERMISSION_GROUPS: CpPermissionGroup[] = [
  {
    id: "org",
    labelKey: "groupOrg",
    permissions: [
      CP_PERMISSION.API_ORG_MEMBERS_READ,
      CP_PERMISSION.API_ORG_MEMBERS_WRITE,
      CP_PERMISSION.API_ORG_INVITES,
      CP_PERMISSION.API_ORG_TRANSFER_OWNERSHIP,
      CP_PERMISSION.API_ORG_DEPARTMENTS,
    ],
  },
  {
    id: "billing",
    labelKey: "groupBilling",
    permissions: [
      CP_PERMISSION.API_BILLING_READ,
      CP_PERMISSION.API_BILLING_MANAGE,
      CP_PERMISSION.API_BILLING_PAYMENT_METHOD,
      CP_PERMISSION.SCREEN_BILLING,
    ],
  },
  {
    id: "workforce",
    labelKey: "groupWorkforce",
    permissions: [
      CP_PERMISSION.API_WORKFORCE_READ,
      CP_PERMISSION.API_WORKFORCE_HIRE,
      CP_PERMISSION.API_WORKFORCE_TERMINATE,
      CP_PERMISSION.API_WORKFORCE_REPROVISION,
      CP_PERMISSION.API_WORKFORCE_SECURITY,
      CP_PERMISSION.API_WORKFORCE_TIMESHEET,
      CP_PERMISSION.API_WORKFORCE_ABSENCES,
      CP_PERMISSION.API_WORKFORCE_ORG,
      CP_PERMISSION.API_WORKFORCE_BOOTSTRAP,
      CP_PERMISSION.API_WORKFORCE_DOCS,
      CP_PERMISSION.API_WORKFORCE_ROSTER,
      CP_PERMISSION.API_WORKFORCE_ATTENDANCE,
      CP_PERMISSION.API_WORKFORCE_IMPORT,
      CP_PERMISSION.API_WORKFORCE_EXPORT,
      CP_PERMISSION.API_WORKFORCE_POSITIONS,
      CP_PERMISSION.API_WORKFORCE_SEATS,
      CP_PERMISSION.API_WORKFORCE_HOLDING,
      CP_PERMISSION.API_WORKFORCE_ROLE_TEMPLATES,
      CP_PERMISSION.API_WORKFORCE_MANUAL_GRANTS,
      CP_PERMISSION.API_WORKFORCE_VACATION,
      CP_PERMISSION.SCREEN_WORKSPACE_WORKFORCE,
    ],
  },
  {
    id: "screens",
    labelKey: "groupScreens",
    permissions: [
      CP_PERMISSION.SCREEN_WORKSPACE_HOME,
      CP_PERMISSION.SCREEN_SETTINGS_TEAM,
      CP_PERMISSION.SCREEN_SETTINGS_ACCESS,
      CP_PERMISSION.SCREEN_HOLDINGS,
    ],
  },
  {
    id: "admin",
    labelKey: "groupAdmin",
    permissions: [
      CP_PERMISSION.ADMIN_ACCESS_MANAGE,
      CP_PERMISSION.ADMIN_PLATFORM,
      CP_PERMISSION.ADMIN_ORG_SETTINGS,
    ],
  },
  {
    id: "finance",
    labelKey: "groupFinance",
    permissions: [
      CP_PERMISSION.API_LEDGER_POST,
      CP_PERMISSION.API_LEDGER_READ,
      CP_PERMISSION.API_LEDGER_PERIOD_CLOSE,
      CP_PERMISSION.API_INVOICES_CREATE,
      CP_PERMISSION.API_INVOICES_UPDATE,
      CP_PERMISSION.API_PURCHASES_MANAGE,
      CP_PERMISSION.API_PAYROLL_MONEY,
      CP_PERMISSION.API_PAYROLL_HR_CARD,
      CP_PERMISSION.API_INVENTORY_APPROVE,
      CP_PERMISSION.API_PSA_MANAGE,
      CP_PERMISSION.API_REPORTS_NAS,
      CP_PERMISSION.API_BOOK_MGMT,
    ],
  },
];

const WORKFORCE_ALL: CpPermission[] = [
  CP_PERMISSION.API_WORKFORCE_READ,
  CP_PERMISSION.API_WORKFORCE_HIRE,
  CP_PERMISSION.API_WORKFORCE_TERMINATE,
  CP_PERMISSION.API_WORKFORCE_REPROVISION,
  CP_PERMISSION.API_WORKFORCE_SECURITY,
  CP_PERMISSION.API_WORKFORCE_TIMESHEET,
  CP_PERMISSION.API_WORKFORCE_ABSENCES,
  CP_PERMISSION.API_WORKFORCE_ORG,
  CP_PERMISSION.API_WORKFORCE_DOCS,
  CP_PERMISSION.API_WORKFORCE_ROSTER,
  CP_PERMISSION.API_WORKFORCE_ATTENDANCE,
  CP_PERMISSION.API_WORKFORCE_IMPORT,
  CP_PERMISSION.API_WORKFORCE_EXPORT,
  CP_PERMISSION.API_WORKFORCE_POSITIONS,
  CP_PERMISSION.API_WORKFORCE_SEATS,
  CP_PERMISSION.API_WORKFORCE_HOLDING,
  CP_PERMISSION.API_WORKFORCE_ROLE_TEMPLATES,
  CP_PERMISSION.API_WORKFORCE_MANUAL_GRANTS,
  CP_PERMISSION.API_WORKFORCE_VACATION,
  CP_PERMISSION.SCREEN_WORKSPACE_WORKFORCE,
];

const WORKFORCE_READ_DEPT: CpPermission[] = [
  CP_PERMISSION.API_WORKFORCE_READ,
  CP_PERMISSION.SCREEN_WORKSPACE_WORKFORCE,
];

const COMMON_SCREENS: CpPermission[] = [CP_PERMISSION.SCREEN_WORKSPACE_HOME];

const ORG_ADMIN: CpPermission[] = [
  CP_PERMISSION.API_ORG_MEMBERS_READ,
  CP_PERMISSION.API_ORG_MEMBERS_WRITE,
  CP_PERMISSION.API_ORG_INVITES,
  CP_PERMISSION.API_ORG_DEPARTMENTS,
  CP_PERMISSION.SCREEN_SETTINGS_TEAM,
  CP_PERMISSION.SCREEN_SETTINGS_ACCESS,
  CP_PERMISSION.ADMIN_ACCESS_MANAGE,
  CP_PERMISSION.ADMIN_ORG_SETTINGS,
  CP_PERMISSION.SCREEN_HOLDINGS,
];

export const GRANTABLE_CP_PERMISSIONS: CpPermission[] =
  ALL_CP_PERMISSIONS.filter((p) => !isLockedCpPermission(p));

/**
 * System role templates. OWNER includes locked keys for honesty;
 * runtime isOwner bypasses regardless of JSON.
 */
export const DEFAULT_CP_ROLE_PERMISSIONS: Record<
  CpSystemRoleCode,
  CpPermission[]
> = {
  OWNER: [...ALL_CP_PERMISSIONS],
  ADMIN: [
    ...COMMON_SCREENS,
    ...ORG_ADMIN,
    CP_PERMISSION.API_BILLING_READ,
    CP_PERMISSION.SCREEN_BILLING,
    ...WORKFORCE_ALL,
    CP_PERMISSION.API_LEDGER_POST,
    CP_PERMISSION.API_LEDGER_READ,
    CP_PERMISSION.API_LEDGER_PERIOD_CLOSE,
    CP_PERMISSION.API_INVOICES_CREATE,
    CP_PERMISSION.API_INVOICES_UPDATE,
    CP_PERMISSION.API_PURCHASES_MANAGE,
    CP_PERMISSION.API_PAYROLL_MONEY,
    CP_PERMISSION.API_PAYROLL_HR_CARD,
    CP_PERMISSION.API_INVENTORY_APPROVE,
    CP_PERMISSION.API_PSA_MANAGE,
    CP_PERMISSION.API_REPORTS_NAS,
    CP_PERMISSION.API_BOOK_MGMT,
  ],
  ACCOUNTANT: [
    ...COMMON_SCREENS,
    CP_PERMISSION.API_LEDGER_POST,
    CP_PERMISSION.API_LEDGER_READ,
    CP_PERMISSION.API_INVOICES_CREATE,
    CP_PERMISSION.API_INVOICES_UPDATE,
    CP_PERMISSION.API_PAYROLL_MONEY,
    CP_PERMISSION.API_REPORTS_NAS,
  ],
  USER: [
    ...COMMON_SCREENS,
    CP_PERMISSION.API_INVOICES_CREATE,
    CP_PERMISSION.API_REPORTS_NAS,
  ],
  PROCUREMENT: [
    ...COMMON_SCREENS,
    CP_PERMISSION.API_PURCHASES_MANAGE,
    CP_PERMISSION.API_REPORTS_NAS,
  ],
  AUDITOR: [
    ...COMMON_SCREENS,
    CP_PERMISSION.API_LEDGER_READ,
    CP_PERMISSION.API_REPORTS_NAS,
  ],
  WAREHOUSE_KEEPER: [
    ...COMMON_SCREENS,
    CP_PERMISSION.API_INVENTORY_APPROVE,
    CP_PERMISSION.API_REPORTS_NAS,
  ],
  HR_OFFICER: [
    ...COMMON_SCREENS,
    CP_PERMISSION.API_PAYROLL_HR_CARD,
    CP_PERMISSION.API_REPORTS_NAS,
    CP_PERMISSION.API_WORKFORCE_READ,
    CP_PERMISSION.SCREEN_WORKSPACE_WORKFORCE,
  ],
  HR_MANAGER: [
    ...COMMON_SCREENS,
    ...WORKFORCE_ALL,
    CP_PERMISSION.API_PAYROLL_HR_CARD,
    CP_PERMISSION.API_REPORTS_NAS,
  ],
  DEPARTMENT_HEAD: [
    ...COMMON_SCREENS,
    ...WORKFORCE_READ_DEPT,
    CP_PERMISSION.API_INVOICES_CREATE,
    CP_PERMISSION.API_REPORTS_NAS,
  ],
  DIRECTOR: [
    ...COMMON_SCREENS,
    CP_PERMISSION.API_ORG_DEPARTMENTS,
    CP_PERMISSION.API_BILLING_READ,
    CP_PERMISSION.API_BILLING_MANAGE,
    CP_PERMISSION.SCREEN_BILLING,
    CP_PERMISSION.API_LEDGER_POST,
    CP_PERMISSION.API_LEDGER_READ,
    CP_PERMISSION.API_REPORTS_NAS,
    CP_PERMISSION.API_BOOK_MGMT,
    CP_PERMISSION.SCREEN_HOLDINGS,
  ],
  PARTNER: [...COMMON_SCREENS, CP_PERMISSION.API_REPORTS_NAS],
};

export const SYSTEM_CP_ROLE_CODES: CpSystemRoleCode[] = [...CP_SYSTEM_ROLE_CODES];

export const SYSTEM_CP_ROLE_NAMES: Record<CpSystemRoleCode, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  ACCOUNTANT: "Accountant",
  USER: "User",
  PROCUREMENT: "Procurement",
  AUDITOR: "Auditor",
  WAREHOUSE_KEEPER: "Warehouse keeper",
  HR_OFFICER: "HR officer",
  HR_MANAGER: "HR manager",
  DEPARTMENT_HEAD: "Department head",
  DIRECTOR: "Director",
  PARTNER: "Partner",
};

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

export function parseCpRolePermissions(json: string): CpPermission[] {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out = new Set<CpPermission>();
    for (const item of parsed) {
      if (typeof item === "string" && isCpPermission(item)) out.add(item);
    }
    return [...out];
  } catch {
    return [];
  }
}

export function serializeCpRolePermissions(perms: CpPermission[]): string {
  return JSON.stringify([...new Set(perms)].sort());
}

export function defaultPermissionsForCpRole(roleCode: string): CpPermission[] {
  if ((CP_SYSTEM_ROLE_CODES as readonly string[]).includes(roleCode)) {
    return [...DEFAULT_CP_ROLE_PERMISSIONS[roleCode as CpSystemRoleCode]];
  }
  return [CP_PERMISSION.SCREEN_WORKSPACE_HOME];
}

export function permissionsJsonForCpRole(roleCode: string): string {
  return serializeCpRolePermissions(defaultPermissionsForCpRole(roleCode));
}

export function effectiveCpRolePermissions(
  roleCode: string,
  permissionsJson: string,
): CpPermission[] {
  if (permissionsJsonNeedsTemplate(permissionsJson)) {
    return defaultPermissionsForCpRole(roleCode);
  }
  return parseCpRolePermissions(permissionsJson);
}

export function isSystemCpRoleCode(code: string): code is CpSystemRoleCode {
  return (CP_SYSTEM_ROLE_CODES as readonly string[]).includes(code);
}

export const CP_CUSTOM_ROLE_CODE_RE = /^[A-Z][A-Z0-9_]{2,31}$/;

export function isValidCustomCpRoleCode(code: string): boolean {
  if (!CP_CUSTOM_ROLE_CODE_RE.test(code)) return false;
  if (isSystemCpRoleCode(code)) return false;
  return true;
}

/**
 * Resolve donor role code for Finance JWT `role` field.
 * System → self; custom → cloneFromCode if system, else USER.
 */
export function donorRoleCodeForOrgRole(input: {
  code: string;
  cloneFromCode: string | null;
}): CpSystemRoleCode {
  if (isSystemCpRoleCode(input.code)) return input.code;
  if (input.cloneFromCode && isSystemCpRoleCode(input.cloneFromCode)) {
    return input.cloneFromCode;
  }
  return "USER";
}

/** System AUDITOR or a custom role cloned from AUDITOR — checker only, never editor. */
export function isAuditorCpRole(
  code: string,
  cloneFromCode?: string | null,
): boolean {
  return code === "AUDITOR" || cloneFromCode === "AUDITOR";
}

/** Keys that must not be granted to an auditor package (allowlist = AUDITOR template). */
export function auditorDisallowedPermissions(
  permissions: readonly string[],
): string[] {
  const allow = new Set<string>(DEFAULT_CP_ROLE_PERMISSIONS.AUDITOR);
  return permissions.filter((p) => !allow.has(p));
}
