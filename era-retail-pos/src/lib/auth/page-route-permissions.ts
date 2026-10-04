import { PERMISSIONS as P, type Permission } from "@/lib/auth/permissions";
import { firstRouteMatch, matchesAnyRoute, type RouteRule } from "@/lib/auth/route-match";

/** Reachable without a staff session. */
export const PUBLIC_STAFF_PAGES: readonly string[] = ["/login", "/sso/callback", "/help", "/help/**"];

/** Any signed-in session; the page enforces its own owner / platform check. */
export const AUTH_ONLY_PAGES: readonly string[] = ["/executive", "/platform"];

/** Any-of grants per staff page. Unlisted pages deny. */
export const PAGE_ROUTE_RULES: readonly RouteRule<readonly Permission[]>[] = [
  ["/", [P.SCREEN_HOME]],
  ["/pos", [P.SCREEN_POS]],
  ["/stock-check", [P.SCREEN_STOCK_CHECK]],
  ["/settings", [P.SCREEN_SETTINGS]],
  ["/admin/import", [P.ADMIN_IMPORT]],
  ["/admin/supplier-match", [P.ADMIN_IMPORT]],
  ["/admin/replenishment", [P.ADMIN_IMPORT]],
  ["/admin/access", [P.SCREEN_ADMIN_ACCESS, P.ACCESS_MANAGE]],
];

export function isPublicStaffPage(pathname: string): boolean {
  return matchesAnyRoute(PUBLIC_STAFF_PAGES, pathname);
}

/** Grants for a staff page, `"auth"` for session-only pages, null when the page is not in the catalog. */
export function routePermissions(pathname: string): readonly Permission[] | "auth" | null {
  if (matchesAnyRoute(AUTH_ONLY_PAGES, pathname)) return "auth";
  return firstRouteMatch(PAGE_ROUTE_RULES, pathname);
}
