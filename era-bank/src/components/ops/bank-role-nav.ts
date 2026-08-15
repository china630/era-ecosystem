/**
 * Ops sidebar visibility by local OpsRole.code.
 * Entitlement modules still apply on top via useBankEntitlements.
 */
export type BankOpsRoleCode =
  | "TELLER"
  | "BRANCH_MANAGER"
  | "AML_OFFICER"
  | "CARDS_OFFICER"
  | "TREASURY_OFFICER"
  | "BUSINESS_OWNER"
  | "PLATFORM_MEMBER"
  | "SATELLITE_OPERATOR";

/** Prefixes (or "*") each role may see in the ops shell. */
export const ROLE_NAV_ALLOW: Record<string, "*" | readonly string[]> = {
  TELLER: [
    "/dashboard",
    "/cif",
    "/accounts",
    "/postings",
    "/payments",
    "/cash",
    "/fees",
    "/deposits",
    "/loans",
    "/gl",
  ],
  BRANCH_MANAGER: "*",
  AML_OFFICER: [
    "/dashboard",
    "/cif",
    "/aml",
    "/reports",
    "/admin/audit",
  ],
  CARDS_OFFICER: [
    "/dashboard",
    "/cif",
    "/accounts",
    "/cards",
    "/card-txns",
  ],
  TREASURY_OFFICER: ["/dashboard", "/treasury", "/reports", "/gl"],
  BUSINESS_OWNER: "*",
  PLATFORM_MEMBER: "*",
  SATELLITE_OPERATOR: [
    "/dashboard",
    "/cif",
    "/accounts",
    "/postings",
    "/payments",
    "/cash",
    "/fees",
    "/collections",
    "/trade",
    "/islamic",
    "/wealth",
    "/deposits",
    "/loans",
    "/reports",
    "/gl",
  ],
};

export function isNavAllowedForRole(
  href: string,
  role: string | null | undefined,
): boolean {
  if (!role) return true;
  const allow = ROLE_NAV_ALLOW[role];
  if (!allow) return true;
  if (allow === "*") return true;
  return allow.some(
    (prefix) => href === prefix || href.startsWith(`${prefix}/`),
  );
}
