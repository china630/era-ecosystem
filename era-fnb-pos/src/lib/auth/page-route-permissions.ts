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
  if (pathname === "/admin/menu" || pathname.startsWith("/admin/menu/")) {
    return [PERMISSIONS.SCREEN_ADMIN_MENU];
  }
  if (pathname === "/admin/tables" || pathname.startsWith("/admin/tables/")) {
    return [PERMISSIONS.SCREEN_ADMIN_TABLES];
  }
  if (
    pathname === "/admin/daily-menu" ||
    pathname.startsWith("/admin/daily-menu/")
  ) {
    return [PERMISSIONS.SCREEN_ADMIN_DAILY_MENU];
  }
  if (pathname === "/admin/import" || pathname.startsWith("/admin/import/")) {
    return [PERMISSIONS.SCREEN_ADMIN_IMPORT];
  }
  if (
    pathname === "/admin/settings" ||
    pathname.startsWith("/admin/settings/")
  ) {
    return [PERMISSIONS.SCREEN_ADMIN_SETTINGS];
  }
  if (
    pathname === "/admin/integration" ||
    pathname.startsWith("/admin/integration/")
  ) {
    return [PERMISSIONS.SCREEN_ADMIN_INTEGRATION];
  }
  if (pathname === "/admin/roster" || pathname.startsWith("/admin/roster/")) {
    return [PERMISSIONS.SCREEN_ADMIN_ROSTER];
  }
  if (pathname.startsWith("/admin")) {
    return [PERMISSIONS.SCREEN_ADMIN_SETTINGS];
  }
  if (pathname === "/floor" || pathname.startsWith("/floor/")) {
    return [PERMISSIONS.SCREEN_FLOOR];
  }
  if (pathname === "/orders" || pathname.startsWith("/orders/")) {
    return [PERMISSIONS.SCREEN_ORDERS];
  }
  if (pathname === "/kds" || pathname.startsWith("/kds/")) {
    return [PERMISSIONS.SCREEN_KDS];
  }
  if (pathname === "/calendar" || pathname.startsWith("/calendar/")) {
    return [PERMISSIONS.SCREEN_CALENDAR];
  }
  if (pathname === "/executive" || pathname.startsWith("/executive/")) {
    return [PERMISSIONS.SCREEN_EXECUTIVE];
  }
  if (pathname === "/" || pathname === "") {
    return [PERMISSIONS.SCREEN_HOME];
  }
  return null;
}

export const PUBLIC_STAFF_PAGE_PREFIXES = [
  "/login",
  "/pin",
  "/m",
  "/sso/callback",
  "/help",
] as const;

export function isPublicStaffPage(pathname: string): boolean {
  return PUBLIC_STAFF_PAGE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}
