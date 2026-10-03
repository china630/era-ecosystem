import { PERMISSIONS as P, type Permission } from "@/lib/auth/permissions";
import { firstRouteMatch, matchesAnyRoute, type RouteRule } from "@/lib/auth/route-match";

/** Reachable without a staff session. */
export const PUBLIC_STAFF_PAGES: readonly string[] = ["/login", "/sso/callback", "/help", "/help/**"];

/** Any signed-in session; the page enforces its own owner / platform check. */
export const AUTH_ONLY_PAGES: readonly string[] = [];

/** Any-of grants per staff page. Unlisted pages deny. */
export const PAGE_ROUTE_RULES: readonly RouteRule<readonly Permission[]>[] = [
  ["/", [P.SCREEN_HOME]],
  ["/orders", [P.SCREEN_ORDERS]],
  ["/pick-lists", [P.SCREEN_PICK_LISTS]],
  ["/admin/import-orders", [P.SCREEN_ADMIN_IMPORT_ORDERS]],
  ["/admin/settings", [P.SCREEN_ADMIN_SETTINGS]],
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
