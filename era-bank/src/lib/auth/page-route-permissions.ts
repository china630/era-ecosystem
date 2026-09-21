import { PERMISSIONS, type Permission } from "@/lib/auth/permissions";

/**
 * Coarse pathname → screen permission(s) for page middleware (any-of).
 * APIs stay on api:/admin: keys. Fail-closed: unknown paths must not return null.
 */
export function routePermissions(pathname: string): Permission[] | null {
  if (
    pathname === "/admin/access" ||
    pathname.startsWith("/admin/access/")
  ) {
    return [PERMISSIONS.SCREEN_ADMIN_ACCESS];
  }
  if (
    pathname === "/admin/audit" ||
    pathname.startsWith("/admin/audit/")
  ) {
    return [PERMISSIONS.SCREEN_ADMIN_AUDIT];
  }
  if (
    pathname === "/admin/branches" ||
    pathname.startsWith("/admin/branches/")
  ) {
    return [PERMISSIONS.SCREEN_ADMIN_BRANCHES];
  }
  if (pathname === "/admin/eod" || pathname.startsWith("/admin/eod/")) {
    return [PERMISSIONS.SCREEN_ADMIN_EOD];
  }
  if (
    pathname === "/admin/product-factory" ||
    pathname.startsWith("/admin/product-factory/")
  ) {
    return [PERMISSIONS.SCREEN_ADMIN_PRODUCT_FACTORY];
  }
  if (pathname.startsWith("/admin")) {
    return [PERMISSIONS.SCREEN_ADMIN_ACCESS];
  }
  if (
    pathname === "/dashboard/executive" ||
    pathname.startsWith("/dashboard/executive/")
  ) {
    return [PERMISSIONS.SCREEN_EXECUTIVE];
  }
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    return [PERMISSIONS.SCREEN_DASHBOARD];
  }
  if (pathname === "/cif" || pathname.startsWith("/cif/")) {
    return [PERMISSIONS.SCREEN_CIF];
  }
  if (pathname === "/accounts" || pathname.startsWith("/accounts/")) {
    return [PERMISSIONS.SCREEN_ACCOUNTS];
  }
  if (pathname === "/postings" || pathname.startsWith("/postings/")) {
    return [PERMISSIONS.SCREEN_POSTINGS];
  }
  if (pathname === "/payments" || pathname.startsWith("/payments/")) {
    return [PERMISSIONS.SCREEN_PAYMENTS];
  }
  if (pathname === "/cash" || pathname.startsWith("/cash/")) {
    return [PERMISSIONS.SCREEN_CASH];
  }
  if (pathname === "/fees" || pathname.startsWith("/fees/")) {
    return [PERMISSIONS.SCREEN_FEES];
  }
  if (pathname === "/deposits" || pathname.startsWith("/deposits/")) {
    return [PERMISSIONS.SCREEN_DEPOSITS];
  }
  if (pathname === "/loans" || pathname.startsWith("/loans/")) {
    return [PERMISSIONS.SCREEN_LOANS];
  }
  if (pathname === "/gl" || pathname.startsWith("/gl/")) {
    return [PERMISSIONS.SCREEN_GL];
  }
  if (pathname === "/aml" || pathname.startsWith("/aml/")) {
    return [PERMISSIONS.SCREEN_AML];
  }
  if (pathname === "/reports" || pathname.startsWith("/reports/")) {
    return [PERMISSIONS.SCREEN_REPORTS];
  }
  if (pathname === "/card-txns" || pathname.startsWith("/card-txns/")) {
    return [PERMISSIONS.SCREEN_CARD_TXNS];
  }
  if (pathname === "/cards" || pathname.startsWith("/cards/")) {
    return [PERMISSIONS.SCREEN_CARDS];
  }
  if (pathname === "/treasury" || pathname.startsWith("/treasury/")) {
    return [PERMISSIONS.SCREEN_TREASURY];
  }
  if (pathname === "/collections" || pathname.startsWith("/collections/")) {
    return [PERMISSIONS.SCREEN_COLLECTIONS];
  }
  if (pathname === "/trade" || pathname.startsWith("/trade/")) {
    return [PERMISSIONS.SCREEN_TRADE];
  }
  if (pathname === "/islamic" || pathname.startsWith("/islamic/")) {
    return [PERMISSIONS.SCREEN_ISLAMIC];
  }
  if (pathname === "/wealth" || pathname.startsWith("/wealth/")) {
    return [PERMISSIONS.SCREEN_WEALTH];
  }
  if (pathname === "/risk" || pathname.startsWith("/risk/")) {
    return [PERMISSIONS.SCREEN_RISK];
  }
  if (pathname === "/markets" || pathname.startsWith("/markets/")) {
    return [PERMISSIONS.SCREEN_MARKETS];
  }
  if (pathname === "/" || pathname === "") {
    return [PERMISSIONS.SCREEN_DASHBOARD];
  }
  return null;
}

export const PUBLIC_STAFF_PAGE_PREFIXES = [
  "/login",
  "/sso/callback",
  "/help",
] as const;

export function isPublicStaffPage(pathname: string): boolean {
  return PUBLIC_STAFF_PAGE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/** Href prefix → screen grant for ops nav visibility. */
export function screenPermissionForNavHref(href: string): Permission | null {
  const required = routePermissions(href);
  return required?.[0] ?? null;
}
