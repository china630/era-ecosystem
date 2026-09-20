import { PERMISSIONS, type Permission } from "@/lib/auth/permissions";

/**
 * Coarse pathname → screen permission(s) for page middleware (any-of).
 * APIs stay on api:/admin: keys. Fail-closed: unknown paths must not return null.
 */
export function routePermissions(pathname: string): Permission[] | null {
  if (pathname === "/settings/access" || pathname.startsWith("/settings/access/")) {
    return [PERMISSIONS.SCREEN_SETTINGS_ACCESS];
  }
  if (pathname === "/settings/users" || pathname.startsWith("/settings/users/")) {
    return [PERMISSIONS.SCREEN_SETTINGS_USERS];
  }
  if (pathname === "/settings/import" || pathname.startsWith("/settings/import/")) {
    return [PERMISSIONS.SCREEN_SETTINGS_IMPORT];
  }
  if (pathname === "/fo/rack" || pathname.startsWith("/fo/rack")) {
    return [PERMISSIONS.SCREEN_FO];
  }
  if (pathname.startsWith("/fo/") || pathname.startsWith("/bookings/")) {
    return [PERMISSIONS.SCREEN_FO];
  }
  if (pathname === "/hk" || pathname.startsWith("/hk/")) {
    return [PERMISSIONS.SCREEN_HK];
  }
  if (pathname.startsWith("/medical")) {
    return [PERMISSIONS.SCREEN_MEDICAL];
  }
  if (pathname.startsWith("/distribution")) {
    return [PERMISSIONS.SCREEN_DISTRIBUTION];
  }
  if (pathname.startsWith("/night-audit")) {
    return [PERMISSIONS.SCREEN_NIGHT_AUDIT];
  }
  if (pathname.startsWith("/front-cash")) {
    return [PERMISSIONS.SCREEN_FRONT_CASH];
  }
  if (pathname.startsWith("/reports")) {
    return [PERMISSIONS.SCREEN_REPORTS];
  }
  if (pathname.startsWith("/folio")) {
    return [PERMISSIONS.SCREEN_FOLIO];
  }
  if (pathname.startsWith("/executive")) {
    return [PERMISSIONS.SCREEN_REPORTS, PERMISSIONS.SCREEN_FO];
  }
  if (pathname.startsWith("/guests") || pathname.startsWith("/reservations")) {
    return [PERMISSIONS.SCREEN_FO];
  }
  if (pathname.startsWith("/service/guest")) {
    return [PERMISSIONS.SCREEN_FO];
  }
  if (pathname.startsWith("/service")) {
    return [PERMISSIONS.SCREEN_HK];
  }
  if (pathname.startsWith("/migration")) {
    return [PERMISSIONS.SCREEN_FO];
  }
  if (pathname.startsWith("/procedures") || pathname.startsWith("/spa")) {
    return [PERMISSIONS.SCREEN_MEDICAL];
  }
  if (
    pathname.startsWith("/tours") ||
    pathname.startsWith("/transfers") ||
    pathname.startsWith("/fleet")
  ) {
    return [PERMISSIONS.SCREEN_TOURS];
  }
  if (pathname.startsWith("/banquets") || pathname.startsWith("/dispatch")) {
    return [PERMISSIONS.SCREEN_FO];
  }
  if (pathname.startsWith("/concierge") || pathname.startsWith("/pos")) {
    return [PERMISSIONS.SCREEN_FO];
  }
  if (pathname.startsWith("/admin")) {
    return [PERMISSIONS.SCREEN_ADMIN];
  }
  if (pathname.startsWith("/settings/")) {
    return [PERMISSIONS.SCREEN_SETTINGS];
  }
  if (pathname === "/" || pathname === "") {
    return [PERMISSIONS.SCREEN_HOME];
  }
  return null;
}

/** @deprecated Prefer routePermissions (any-of). */
export function routePermission(pathname: string): Permission | null {
  const list = routePermissions(pathname);
  return list?.[0] ?? null;
}

export const PUBLIC_STAFF_PAGE_PREFIXES = [
  "/login",
  "/sso/callback",
  "/help",
  "/b2c",
] as const;

export function isPublicStaffPage(pathname: string): boolean {
  return PUBLIC_STAFF_PAGE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}
