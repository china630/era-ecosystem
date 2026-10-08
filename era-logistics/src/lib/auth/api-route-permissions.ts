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

/** Any signed-in session; no grant. Tracking selects the trip by the path token. */
export const AUTH_ONLY_API_ROUTES: readonly string[] = [
  "/api/auth/me",
  "/api/auth/session/refresh-permissions",
  "/api/platform/billing-snapshot",
  "/api/tracking/*",
];

/** Staff routes that check their own credential instead of `getSatelliteSession()`. */
export const HANDLER_GATE_EXCEPTIONS: readonly string[] = [
  /** Kit billing banner: verifies the session token itself, read-only status. */
  "/api/platform/billing-status",
];

/** Any-of grants per staff API. Unlisted paths deny. First match wins. */
export const API_ROUTE_RULES: readonly RouteRule<readonly Permission[]>[] = [
  ["/api/admin/**", [P.ACCESS_MANAGE]],
  ["/api/trips", [P.TRIPS]],
  ["/api/trips/*/waybill", [P.TRIPS_WAYBILL]],
  ["/api/trips/*/pod", [P.TRIPS_POD]],
  ["/api/trips/*/complete", [P.TRIPS_COMPLETE]],
  ["/api/trips/*/points", [P.TRIPS_POINTS]],
  ["/api/trips/*/points/*", [P.TRIPS_POINTS]],
  ["/api/trips/*/fuel-report", [P.REPORTS_FUEL]],
  ["/api/trips/*", [P.TRIPS]],
  ["/api/shipments/*/rate", [P.TRIPS]],
  ["/api/sla/eta", [P.TRIPS]],
  ["/api/driver/trips", [P.DRIVER_TRIPS]],
  ["/api/fleet/alerts", [P.FLEET_ALERTS]],
  ["/api/hub/scan", [P.HUB_SCAN]],
  ["/api/cod/settle", [P.COD_SETTLE]],
  ["/api/reports/fuel", [P.REPORTS_FUEL]],
  ["/api/hs-preview", [P.CUSTOMS_PREVIEW]],
  ["/api/fx-preview", [P.CUSTOMS_PREVIEW]],
];

/** Grants for a staff API, `"auth"` for session-only routes, null when the route is not in the catalog. */
export function apiRoutePermissions(pathname: string): readonly Permission[] | "auth" | null {
  if (matchesAnyRoute(AUTH_ONLY_API_ROUTES, pathname)) return "auth";
  return firstRouteMatch(API_ROUTE_RULES, pathname);
}
