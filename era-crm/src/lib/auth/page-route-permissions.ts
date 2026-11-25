import { PERMISSIONS as P, type Permission } from "@/lib/auth/permissions";
import { firstRouteMatch, matchesAnyRoute, type RouteRule } from "@/lib/auth/route-match";

/** Reachable without a staff session. */
export const PUBLIC_STAFF_PAGES: readonly string[] = ["/login", "/sso/callback", "/help", "/help/**"];

/** Any signed-in session; the page enforces its own owner / platform check. */
export const AUTH_ONLY_PAGES: readonly string[] = [];

/** Any-of grants per staff page. Unlisted pages deny. */
export const PAGE_ROUTE_RULES: readonly RouteRule<readonly Permission[]>[] = [
  ["/", [P.SCREEN_HOME]],
  ["/leads", [P.SCREEN_LEADS]],
  ["/leads/*", [P.SCREEN_LEADS_DETAIL]],
  ["/unsorted", [P.SCREEN_LEADS]],
  ["/parties", [P.SCREEN_LEADS]],
  ["/inbox", [P.SCREEN_INBOX]],
  ["/visits", [P.SCREEN_VISITS]],
  ["/reports", [P.SCREEN_REPORTS]],
  ["/admin/import", [P.ADMIN_IMPORT]],
  ["/admin/settings", [P.ADMIN_PIPELINE]],
  ["/admin/pipelines", [P.ADMIN_PIPELINE]],
  ["/admin/custom-fields", [P.ADMIN_PIPELINE]],
  ["/admin/links", [P.ADMIN_PIPELINE]],
  ["/admin/integrations", [P.SCREEN_ADMIN_INTEGRATIONS, P.ADMIN_INTEGRATIONS]],
  ["/admin/integrations/**", [P.SCREEN_ADMIN_INTEGRATIONS, P.ADMIN_INTEGRATIONS]],
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
