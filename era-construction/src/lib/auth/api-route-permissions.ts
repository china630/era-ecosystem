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

/** Any-of grants per staff API. Unlisted paths deny. */
export const API_ROUTE_RULES: readonly RouteRule<readonly Permission[]>[] = [
  ["/api/admin/**", [P.ACCESS_MANAGE]],
  ["/api/projects", [P.PROJECTS]],
  ["/api/projects/*/plan-vs-actual", [P.BOQ]],
  ["/api/projects/*/daily-logs", [P.DAILY_LOGS]],
  ["/api/projects/*/punch-list", [P.PUNCH_LIST]],
  ["/api/projects/*/gantt", [P.GANTT]],
  ["/api/projects/*/subcontractor-claims", [P.SUBCONTRACTOR_CLAIMS]],
  ["/api/material-requisitions", [P.REQUISITIONS]],
  ["/api/progress-acts/*/approve", [P.ACTS_APPROVE]],
  ["/api/timesheets/import", [P.TIMESHEETS_IMPORT]],
  ["/api/equipment/hours", [P.EQUIPMENT_HOURS]],
  ["/api/cde/documents", [P.CDE]],
  ["/api/calendar/working-day", [P.TIMESHEETS_IMPORT, P.DAILY_LOGS]],
  ["/api/counterparties/voen-preview", [P.SUBCONTRACTOR_CLAIMS, P.PROJECTS]],
];

/** Grants for a staff API, `"auth"` for session-only routes, null when the route is not in the catalog. */
export function apiRoutePermissions(pathname: string): readonly Permission[] | "auth" | null {
  if (matchesAnyRoute(AUTH_ONLY_API_ROUTES, pathname)) return "auth";
  return firstRouteMatch(API_ROUTE_RULES, pathname);
}
