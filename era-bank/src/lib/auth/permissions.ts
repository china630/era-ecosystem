/**
 * Bank Variant A permission catalog (catalogVersion 1).
 * Keys: api: / screen: / admin: only — role name grants nothing.
 */

export const PERMISSIONS = {
  // Screens
  SCREEN_DASHBOARD: "screen:dashboard",
  SCREEN_EXECUTIVE: "screen:executive",
  SCREEN_CIF: "screen:cif",
  SCREEN_ACCOUNTS: "screen:accounts",
  SCREEN_POSTINGS: "screen:postings",
  SCREEN_PAYMENTS: "screen:payments",
  SCREEN_CASH: "screen:cash",
  SCREEN_FEES: "screen:fees",
  SCREEN_DEPOSITS: "screen:deposits",
  SCREEN_LOANS: "screen:loans",
  SCREEN_GL: "screen:gl",
  SCREEN_AML: "screen:aml",
  SCREEN_REPORTS: "screen:reports",
  SCREEN_CARDS: "screen:cards",
  SCREEN_CARD_TXNS: "screen:card_txns",
  SCREEN_TREASURY: "screen:treasury",
  SCREEN_COLLECTIONS: "screen:collections",
  SCREEN_TRADE: "screen:trade",
  SCREEN_ISLAMIC: "screen:islamic",
  SCREEN_WEALTH: "screen:wealth",
  SCREEN_RISK: "screen:risk",
  SCREEN_MARKETS: "screen:markets",
  SCREEN_ADMIN_AUDIT: "screen:admin.audit",
  SCREEN_ADMIN_BRANCHES: "screen:admin.branches",
  SCREEN_ADMIN_EOD: "screen:admin.eod",
  SCREEN_ADMIN_PRODUCT_FACTORY: "screen:admin.product_factory",
  SCREEN_ADMIN_ACCESS: "screen:admin.access",

  // Admin
  ACCESS_MANAGE: "admin:access_manage",
  USERS: "admin:users",

  // API — coarse BFF areas
  CIF_READ: "api:cif.read",
  CIF_WRITE: "api:cif.write",
  ACCOUNTS_READ: "api:accounts.read",
  ACCOUNTS_WRITE: "api:accounts.write",
  POSTINGS_READ: "api:postings.read",
  POSTINGS_WRITE: "api:postings.write",
  POSTINGS_APPROVE: "api:postings.approve",
  POSTINGS_REJECT: "api:postings.reject",
  POSTINGS_REVERSE: "api:postings.reverse",
  PAYMENTS_READ: "api:payments.read",
  PAYMENTS_WRITE: "api:payments.write",
  PAYMENTS_APPROVE: "api:payments.approve",
  PAYMENTS_REJECT: "api:payments.reject",
  CASH_READ: "api:cash.read",
  CASH_WRITE: "api:cash.write",
  FEES_READ: "api:fees.read",
  FEES_WRITE: "api:fees.write",
  DEPOSITS_READ: "api:deposits.read",
  DEPOSITS_WRITE: "api:deposits.write",
  DEPOSITS_APPROVE: "api:deposits.approve",
  DEPOSITS_REJECT: "api:deposits.reject",
  LOANS_READ: "api:loans.read",
  LOANS_WRITE: "api:loans.write",
  LOANS_APPROVE: "api:loans.approve",
  LOANS_REJECT: "api:loans.reject",
  GL_READ: "api:gl.read",
  GL_WRITE: "api:gl.write",
  AML_READ: "api:aml.read",
  AML_WRITE: "api:aml.write",
  AML_FMN: "api:aml.fmn",
  REPORTS_READ: "api:reports.read",
  CARDS_READ: "api:cards.read",
  CARDS_WRITE: "api:cards.write",
  CARDS_ISSUE: "api:cards.issue",
  CARD_TXNS_READ: "api:card_txns.read",
  CARD_TXNS_WRITE: "api:card_txns.write",
  TREASURY_READ: "api:treasury.read",
  TREASURY_WRITE: "api:treasury.write",
  TREASURY_FX: "api:treasury.fx",
  COLLECTIONS_READ: "api:collections.read",
  COLLECTIONS_WRITE: "api:collections.write",
  COLLECTIONS_APPROVE: "api:collections.approve",
  TRADE_READ: "api:trade.read",
  TRADE_WRITE: "api:trade.write",
  ISLAMIC_READ: "api:islamic.read",
  ISLAMIC_WRITE: "api:islamic.write",
  WEALTH_READ: "api:wealth.read",
  WEALTH_WRITE: "api:wealth.write",
  RISK_READ: "api:risk.read",
  RISK_WRITE: "api:risk.write",
  RISK_APPROVE: "api:risk.approve",
  RISK_REJECT: "api:risk.reject",
  MARKETS_READ: "api:markets.read",
  MARKETS_WRITE: "api:markets.write",
  ATM_READ: "api:atm.read",
  ATM_WRITE: "api:atm.write",
  BRANCHES_READ: "api:branches.read",
  BRANCHES_WRITE: "api:branches.write",
  EOD_RUN: "api:eod.run",
  PRODUCT_FACTORY_MANAGE: "api:product_factory.manage",
  AUDIT_READ: "api:audit.read",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLE_CODES = {
  TELLER: "TELLER",
  BRANCH_MANAGER: "BRANCH_MANAGER",
  AML_OFFICER: "AML_OFFICER",
  CARDS_OFFICER: "CARDS_OFFICER",
  TREASURY_OFFICER: "TREASURY_OFFICER",
  BUSINESS_OWNER: "BUSINESS_OWNER",
  PLATFORM_MEMBER: "PLATFORM_MEMBER",
  SATELLITE_OPERATOR: "SATELLITE_OPERATOR",
} as const;

export type RoleCode = (typeof ROLE_CODES)[keyof typeof ROLE_CODES];

export const ALL_PERMISSIONS = Object.values(PERMISSIONS);

export const SYSTEM_BANK_ROLES: RoleCode[] = [
  ROLE_CODES.TELLER,
  ROLE_CODES.BRANCH_MANAGER,
  ROLE_CODES.AML_OFFICER,
  ROLE_CODES.CARDS_OFFICER,
  ROLE_CODES.TREASURY_OFFICER,
  ROLE_CODES.BUSINESS_OWNER,
  ROLE_CODES.PLATFORM_MEMBER,
  ROLE_CODES.SATELLITE_OPERATOR,
];

export const SYSTEM_ROLE_NAMES: Record<RoleCode, string> = {
  [ROLE_CODES.TELLER]: "Teller",
  [ROLE_CODES.BRANCH_MANAGER]: "Branch manager",
  [ROLE_CODES.AML_OFFICER]: "Compliance / AML",
  [ROLE_CODES.CARDS_OFFICER]: "Cards officer",
  [ROLE_CODES.TREASURY_OFFICER]: "Treasury officer",
  [ROLE_CODES.BUSINESS_OWNER]: "Business Owner",
  [ROLE_CODES.PLATFORM_MEMBER]: "Platform Member",
  [ROLE_CODES.SATELLITE_OPERATOR]: "Satellite Operator",
};

export function isSystemBankRoleCode(code: string): code is RoleCode {
  return (SYSTEM_BANK_ROLES as string[]).includes(code);
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
      PERMISSIONS.SCREEN_DASHBOARD,
      PERMISSIONS.SCREEN_EXECUTIVE,
      PERMISSIONS.SCREEN_CIF,
      PERMISSIONS.SCREEN_ACCOUNTS,
      PERMISSIONS.SCREEN_POSTINGS,
      PERMISSIONS.SCREEN_PAYMENTS,
      PERMISSIONS.SCREEN_CASH,
      PERMISSIONS.SCREEN_FEES,
      PERMISSIONS.SCREEN_DEPOSITS,
      PERMISSIONS.SCREEN_LOANS,
      PERMISSIONS.SCREEN_GL,
      PERMISSIONS.SCREEN_AML,
      PERMISSIONS.SCREEN_REPORTS,
      PERMISSIONS.SCREEN_CARDS,
      PERMISSIONS.SCREEN_CARD_TXNS,
      PERMISSIONS.SCREEN_TREASURY,
      PERMISSIONS.SCREEN_COLLECTIONS,
      PERMISSIONS.SCREEN_TRADE,
      PERMISSIONS.SCREEN_ISLAMIC,
      PERMISSIONS.SCREEN_WEALTH,
      PERMISSIONS.SCREEN_RISK,
      PERMISSIONS.SCREEN_MARKETS,
      PERMISSIONS.SCREEN_ADMIN_AUDIT,
      PERMISSIONS.SCREEN_ADMIN_BRANCHES,
      PERMISSIONS.SCREEN_ADMIN_EOD,
      PERMISSIONS.SCREEN_ADMIN_PRODUCT_FACTORY,
      PERMISSIONS.SCREEN_ADMIN_ACCESS,
    ],
  },
  {
    id: "core",
    labelKey: "groupCore",
    permissions: [
      PERMISSIONS.CIF_READ,
      PERMISSIONS.CIF_WRITE,
      PERMISSIONS.ACCOUNTS_READ,
      PERMISSIONS.ACCOUNTS_WRITE,
      PERMISSIONS.POSTINGS_READ,
      PERMISSIONS.POSTINGS_WRITE,
      PERMISSIONS.POSTINGS_APPROVE,
      PERMISSIONS.POSTINGS_REJECT,
      PERMISSIONS.POSTINGS_REVERSE,
      PERMISSIONS.GL_READ,
      PERMISSIONS.GL_WRITE,
      PERMISSIONS.FEES_READ,
      PERMISSIONS.FEES_WRITE,
      PERMISSIONS.BRANCHES_READ,
      PERMISSIONS.BRANCHES_WRITE,
      PERMISSIONS.EOD_RUN,
      PERMISSIONS.PRODUCT_FACTORY_MANAGE,
      PERMISSIONS.AUDIT_READ,
    ],
  },
  {
    id: "payments",
    labelKey: "groupPayments",
    permissions: [
      PERMISSIONS.PAYMENTS_READ,
      PERMISSIONS.PAYMENTS_WRITE,
      PERMISSIONS.PAYMENTS_APPROVE,
      PERMISSIONS.PAYMENTS_REJECT,
      PERMISSIONS.CASH_READ,
      PERMISSIONS.CASH_WRITE,
    ],
  },
  {
    id: "products",
    labelKey: "groupProducts",
    permissions: [
      PERMISSIONS.DEPOSITS_READ,
      PERMISSIONS.DEPOSITS_WRITE,
      PERMISSIONS.DEPOSITS_APPROVE,
      PERMISSIONS.DEPOSITS_REJECT,
      PERMISSIONS.LOANS_READ,
      PERMISSIONS.LOANS_WRITE,
      PERMISSIONS.LOANS_APPROVE,
      PERMISSIONS.LOANS_REJECT,
      PERMISSIONS.COLLECTIONS_READ,
      PERMISSIONS.COLLECTIONS_WRITE,
      PERMISSIONS.COLLECTIONS_APPROVE,
      PERMISSIONS.TRADE_READ,
      PERMISSIONS.TRADE_WRITE,
      PERMISSIONS.ISLAMIC_READ,
      PERMISSIONS.ISLAMIC_WRITE,
      PERMISSIONS.WEALTH_READ,
      PERMISSIONS.WEALTH_WRITE,
    ],
  },
  {
    id: "cards",
    labelKey: "groupCards",
    permissions: [
      PERMISSIONS.CARDS_READ,
      PERMISSIONS.CARDS_WRITE,
      PERMISSIONS.CARDS_ISSUE,
      PERMISSIONS.CARD_TXNS_READ,
      PERMISSIONS.CARD_TXNS_WRITE,
      PERMISSIONS.ATM_READ,
      PERMISSIONS.ATM_WRITE,
    ],
  },
  {
    id: "aml",
    labelKey: "groupAml",
    permissions: [
      PERMISSIONS.AML_READ,
      PERMISSIONS.AML_WRITE,
      PERMISSIONS.AML_FMN,
      PERMISSIONS.REPORTS_READ,
    ],
  },
  {
    id: "treasury",
    labelKey: "groupTreasury",
    permissions: [
      PERMISSIONS.TREASURY_READ,
      PERMISSIONS.TREASURY_WRITE,
      PERMISSIONS.TREASURY_FX,
      PERMISSIONS.MARKETS_READ,
      PERMISSIONS.MARKETS_WRITE,
      PERMISSIONS.RISK_READ,
      PERMISSIONS.RISK_WRITE,
      PERMISSIONS.RISK_APPROVE,
      PERMISSIONS.RISK_REJECT,
    ],
  },
  {
    id: "admin",
    labelKey: "groupAdmin",
    permissions: [PERMISSIONS.ACCESS_MANAGE, PERMISSIONS.USERS],
  },
];

const P = PERMISSIONS;

const TELLER_SCREENS: Permission[] = [
  P.SCREEN_DASHBOARD,
  P.SCREEN_CIF,
  P.SCREEN_ACCOUNTS,
  P.SCREEN_POSTINGS,
  P.SCREEN_PAYMENTS,
  P.SCREEN_CASH,
  P.SCREEN_FEES,
  P.SCREEN_DEPOSITS,
  P.SCREEN_LOANS,
  P.SCREEN_GL,
];

const TELLER_API: Permission[] = [
  P.CIF_READ,
  P.CIF_WRITE,
  P.ACCOUNTS_READ,
  P.ACCOUNTS_WRITE,
  P.POSTINGS_READ,
  P.POSTINGS_WRITE,
  P.PAYMENTS_READ,
  P.PAYMENTS_WRITE,
  P.CASH_READ,
  P.CASH_WRITE,
  P.FEES_READ,
  P.FEES_WRITE,
  P.DEPOSITS_READ,
  P.DEPOSITS_WRITE,
  P.LOANS_READ,
  P.LOANS_WRITE,
  P.GL_READ,
];

const APPROVE_SET: Permission[] = [
  P.POSTINGS_APPROVE,
  P.POSTINGS_REJECT,
  P.POSTINGS_REVERSE,
  P.PAYMENTS_APPROVE,
  P.PAYMENTS_REJECT,
  P.DEPOSITS_APPROVE,
  P.DEPOSITS_REJECT,
  P.LOANS_APPROVE,
  P.LOANS_REJECT,
  P.COLLECTIONS_APPROVE,
  P.RISK_APPROVE,
  P.RISK_REJECT,
];

const READ_ALL: Permission[] = ALL_PERMISSIONS.filter(
  (x) => x.startsWith("api:") && x.endsWith(".read"),
);

const WRITE_ALL: Permission[] = ALL_PERMISSIONS.filter(
  (x) =>
    x.startsWith("api:") &&
    (x.endsWith(".write") ||
      x.endsWith(".approve") ||
      x.endsWith(".reject") ||
      x.endsWith(".reverse") ||
      x === P.EOD_RUN ||
      x === P.PRODUCT_FACTORY_MANAGE ||
      x === P.AML_FMN ||
      x === P.CARDS_ISSUE ||
      x === P.TREASURY_FX),
);

const SCREEN_ALL: Permission[] = ALL_PERMISSIONS.filter((x) =>
  x.startsWith("screen:"),
);

export function tellerPermissions(): Permission[] {
  return [...TELLER_SCREENS, ...TELLER_API];
}

export function branchManagerPermissions(): Permission[] {
  return [
    ...SCREEN_ALL,
    ...READ_ALL,
    ...WRITE_ALL,
    P.ACCESS_MANAGE,
    P.USERS,
    P.AUDIT_READ,
  ];
}

export function amlOfficerPermissions(): Permission[] {
  return [
    P.SCREEN_DASHBOARD,
    P.SCREEN_CIF,
    P.SCREEN_AML,
    P.SCREEN_REPORTS,
    P.SCREEN_ADMIN_AUDIT,
    P.CIF_READ,
    P.AML_READ,
    P.AML_WRITE,
    P.AML_FMN,
    P.REPORTS_READ,
    P.AUDIT_READ,
  ];
}

export function cardsOfficerPermissions(): Permission[] {
  return [
    P.SCREEN_DASHBOARD,
    P.SCREEN_CIF,
    P.SCREEN_ACCOUNTS,
    P.SCREEN_CARDS,
    P.SCREEN_CARD_TXNS,
    P.CIF_READ,
    P.ACCOUNTS_READ,
    P.CARDS_READ,
    P.CARDS_WRITE,
    P.CARDS_ISSUE,
    P.CARD_TXNS_READ,
    P.CARD_TXNS_WRITE,
    P.ATM_READ,
    P.ATM_WRITE,
  ];
}

export function treasuryOfficerPermissions(): Permission[] {
  return [
    P.SCREEN_DASHBOARD,
    P.SCREEN_TREASURY,
    P.SCREEN_REPORTS,
    P.SCREEN_GL,
    P.SCREEN_MARKETS,
    P.TREASURY_READ,
    P.TREASURY_WRITE,
    P.TREASURY_FX,
    P.MARKETS_READ,
    P.MARKETS_WRITE,
    P.REPORTS_READ,
    P.GL_READ,
  ];
}

/** Owner bypass expands ALL at runtime; stored JSON may be empty. */
export function businessOwnerPermissions(): Permission[] {
  return [];
}

export function platformMemberPermissions(): Permission[] {
  return [
    P.SCREEN_DASHBOARD,
    P.SCREEN_EXECUTIVE,
    P.SCREEN_REPORTS,
    P.SCREEN_GL,
    P.SCREEN_RISK,
    ...READ_ALL,
  ];
}

export function satelliteOperatorPermissions(): Permission[] {
  return [
    P.SCREEN_DASHBOARD,
    P.SCREEN_CIF,
    P.SCREEN_ACCOUNTS,
    P.SCREEN_POSTINGS,
    P.SCREEN_PAYMENTS,
    P.SCREEN_CASH,
    P.SCREEN_FEES,
    P.SCREEN_COLLECTIONS,
    P.SCREEN_TRADE,
    P.SCREEN_ISLAMIC,
    P.SCREEN_WEALTH,
    P.SCREEN_DEPOSITS,
    P.SCREEN_LOANS,
    P.SCREEN_REPORTS,
    P.SCREEN_GL,
    ...TELLER_API,
    P.COLLECTIONS_READ,
    P.COLLECTIONS_WRITE,
    P.TRADE_READ,
    P.TRADE_WRITE,
    P.ISLAMIC_READ,
    P.ISLAMIC_WRITE,
    P.WEALTH_READ,
    P.WEALTH_WRITE,
    P.REPORTS_READ,
  ];
}

export function permissionsForRole(roleCode: string): Permission[] {
  switch (roleCode) {
    case ROLE_CODES.TELLER:
      return tellerPermissions();
    case ROLE_CODES.BRANCH_MANAGER:
      return branchManagerPermissions();
    case ROLE_CODES.AML_OFFICER:
      return amlOfficerPermissions();
    case ROLE_CODES.CARDS_OFFICER:
      return cardsOfficerPermissions();
    case ROLE_CODES.TREASURY_OFFICER:
      return treasuryOfficerPermissions();
    case ROLE_CODES.BUSINESS_OWNER:
      return businessOwnerPermissions();
    case ROLE_CODES.PLATFORM_MEMBER:
      return platformMemberPermissions();
    case ROLE_CODES.SATELLITE_OPERATOR:
      return satelliteOperatorPermissions();
    default:
      return [];
  }
}

export function serializePermissions(perms: Permission[]): string {
  const seen = new Set<string>();
  const out: Permission[] = [];
  for (const p of perms) {
    if (isBankPermission(p) && !seen.has(p)) {
      seen.add(p);
      out.push(p);
    }
  }
  return JSON.stringify(out);
}

export function isBankPermission(value: string): value is Permission {
  return (ALL_PERMISSIONS as string[]).includes(value);
}

export function parsePermissions(json: string): Permission[] {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(String).filter(isBankPermission);
  } catch {
    return [];
  }
}

export function coerceBankPermission(raw: string): Permission | null {
  return isBankPermission(raw) ? raw : null;
}

export function effectiveRolePermissions(
  roleCode: string,
  permissionsJson: string,
): Permission[] {
  try {
    const parsed = JSON.parse(permissionsJson) as unknown;
    if (Array.isArray(parsed)) {
      return parsePermissions(permissionsJson);
    }
  } catch {
    // fall through
  }
  return permissionsForRole(roleCode);
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

export const BANK_ROLE_ALIASES: Record<string, RoleCode> = {
  TELLER: ROLE_CODES.TELLER,
  BRANCH_MANAGER: ROLE_CODES.BRANCH_MANAGER,
  MANAGER: ROLE_CODES.BRANCH_MANAGER,
  AML_OFFICER: ROLE_CODES.AML_OFFICER,
  AML: ROLE_CODES.AML_OFFICER,
  COMPLIANCE: ROLE_CODES.AML_OFFICER,
  CARDS_OFFICER: ROLE_CODES.CARDS_OFFICER,
  CARDS: ROLE_CODES.CARDS_OFFICER,
  TREASURY_OFFICER: ROLE_CODES.TREASURY_OFFICER,
  TREASURY: ROLE_CODES.TREASURY_OFFICER,
  BUSINESS_OWNER: ROLE_CODES.BUSINESS_OWNER,
  PLATFORM_MEMBER: ROLE_CODES.PLATFORM_MEMBER,
  SATELLITE_OPERATOR: ROLE_CODES.SATELLITE_OPERATOR,
};

export function resolveBankRoleCode(raw: string): RoleCode | null {
  const key = raw.trim().toUpperCase();
  return BANK_ROLE_ALIASES[key] ?? (isSystemBankRoleCode(raw) ? raw : null);
}

/** Numeric-only limits keys after Variant A. */
export const LIMITS_NUMERIC_KEYS = [
  "maxDebitMinor",
  "dailyPostingLimitAzn",
] as const;

export function sanitizeLimitsJson(
  raw: Record<string, unknown> | null | undefined,
): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const key of LIMITS_NUMERIC_KEYS) {
    const v = raw[key];
    if (typeof v === "number" && Number.isFinite(v)) out[key] = v;
  }
  return out;
}

/** Approve/reject/reverse grant set (grant ∩ engine SoD). */
export const APPROVE_PERMISSIONS = APPROVE_SET;
