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
  /** `PLATFORM_CRON_SECRET` via `runCronForEachTenant`; not a staff grant. */
  "/api/cron/service-due",
];

/** Any-of grants per staff API. Unlisted paths deny. */
export const API_ROUTE_RULES: readonly RouteRule<readonly Permission[]>[] = [
  ["/api/admin/**", [P.ACCESS_MANAGE]],
  ["/api/work-orders", [P.WORK_ORDERS]],
  ["/api/work-orders/*/*", [P.WORK_ORDERS]],
  ["/api/appointments", [P.APPOINTMENTS]],
  ["/api/vehicles", [P.VEHICLES]],
  ["/api/vehicles/history", [P.VEHICLES]],
  ["/api/parts/catalog", [P.PARTS_CATALOG]],
  ["/api/tools", [P.TOOLS]],
  ["/api/tools/checkout", [P.TOOLS]],
  ["/api/calendar", [P.CALENDAR]],
  ["/api/calendar/next-working-day", [P.CALENDAR]],
  ["/api/mdm/voen-lookup", [P.WORK_ORDERS]],
  ["/api/counterparties/voen-preview", [P.WORK_ORDERS]],
];

/** Grants for a staff API, `"auth"` for session-only routes, null when the route is not in the catalog. */
export function apiRoutePermissions(pathname: string): readonly Permission[] | "auth" | null {
  if (matchesAnyRoute(AUTH_ONLY_API_ROUTES, pathname)) return "auth";
  return firstRouteMatch(API_ROUTE_RULES, pathname);
}
