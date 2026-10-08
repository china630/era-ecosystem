import { PERMISSIONS as P, type Permission } from "@/lib/auth/permissions";
import { firstRouteMatch, matchesAnyRoute, type RouteRule } from "@/lib/auth/route-match";

/** Middleware public prefixes, plus `POST /api/auth/logout` (clears the cookie; the edge still requires it). */
export const PUBLIC_API_ROUTES: readonly string[] = [
  "/api/health",
  "/api/locale",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/sso/exchange",
  "/api/internal/**",
  "/api/events/dispatch",
];

/** Any signed-in session; no grant. */
export const AUTH_ONLY_API_ROUTES: readonly string[] = [
  "/api/auth/me",
  "/api/auth/session/refresh-permissions",
  "/api/platform/billing-snapshot",
];

/** Staff routes that check their own credential instead of `getSatelliteSession()`. */
export const HANDLER_GATE_EXCEPTIONS: readonly string[] = [
  /** Kit billing banner: verifies the session token itself, read-only status. */
  "/api/platform/billing-status",
];

/**
 * Any-of grants per staff API. Unlisted paths deny. First match wins, so
 * `/api/leads/import*` sits above `/api/leads/*`. Routes with two methods
 * on one path list both grants here and assert the method grant in the handler.
 */
export const API_ROUTE_RULES: readonly RouteRule<readonly Permission[]>[] = [
  ["/api/admin/**", [P.ACCESS_MANAGE]],
  ["/api/leads/import", [P.ADMIN_IMPORT]],
  ["/api/leads/import/*", [P.ADMIN_IMPORT]],
  ["/api/leads/next-contact-due", [P.LEADS_READ]],
  ["/api/leads", [P.LEADS_READ, P.LEADS_WRITE]],
  ["/api/leads/*/assign", [P.LEADS_ASSIGN]],
  ["/api/leads/*/stage", [P.LEADS_STAGE]],
  ["/api/leads/*/convert", [P.LEADS_CONVERT]],
  ["/api/leads/*/follow-up", [P.LEADS_FOLLOW_UP]],
  ["/api/leads/*/score", [P.LEADS_WRITE]],
  ["/api/leads/*", [P.LEADS_READ, P.LEADS_WRITE]],
  ["/api/counterparties/voen-preview", [P.LEADS_READ]],
  ["/api/mdm/person-lookup", [P.LEADS_WRITE]],
  ["/api/mdm/voen-lookup", [P.LEADS_WRITE, P.ADMIN_PIPELINE]],
  ["/api/inbox", [P.INBOX]],
  ["/api/visits", [P.VISITS]],
  ["/api/lookups", [P.LOOKUPS]],
  ["/api/lookups/*", [P.LOOKUPS]],
  ["/api/users", [P.USERS_LIST]],
  ["/api/pipeline/rules", [P.ADMIN_PIPELINE]],
];

/** Grants for a staff API, `"auth"` for session-only routes, null when the route is not in the catalog. */
export function apiRoutePermissions(pathname: string): readonly Permission[] | "auth" | null {
  if (matchesAnyRoute(AUTH_ONLY_API_ROUTES, pathname)) return "auth";
  return firstRouteMatch(API_ROUTE_RULES, pathname);
}
