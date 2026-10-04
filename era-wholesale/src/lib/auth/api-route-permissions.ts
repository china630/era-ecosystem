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
export const HANDLER_GATE_EXCEPTIONS: readonly string[] = [];

/** Any-of grants per staff API. Unlisted paths deny. */
export const API_ROUTE_RULES: readonly RouteRule<readonly Permission[]>[] = [
  ["/api/admin/**", [P.ACCESS_MANAGE]],
  ["/api/orders", [P.ORDERS]],
  ["/api/orders/*/confirm", [P.ORDERS_CONFIRM]],
  ["/api/orders/*/pay", [P.ORDERS_PAY]],
  ["/api/orders/*/ttn", [P.ORDERS_TTN]],
  ["/api/pick-lists", [P.PICK]],
  ["/api/pick-lists/*/lines/*", [P.PICK]],
  ["/api/pick-waves", [P.PICK_WAVES]],
  ["/api/credit-limit", [P.CREDIT_LIMIT]],
  ["/api/edi/export", [P.EDI_EXPORT]],
  ["/api/fx-preview", [P.FX_PREVIEW]],
  ["/api/counterparties/voen-preview", [P.ORDERS]],
  ["/api/mdm/voen-lookup", [P.ORDERS, P.ADMIN_IMPORT_ORDERS]],
  ["/api/payment-terms/due-date", [P.ORDERS, P.ADMIN_IMPORT_ORDERS]],
  ["/api/import-orders", [P.ADMIN_IMPORT_ORDERS]],
];

/** Grants for a staff API, `"auth"` for session-only routes, null when the route is not in the catalog. */
export function apiRoutePermissions(pathname: string): readonly Permission[] | "auth" | null {
  if (matchesAnyRoute(AUTH_ONLY_API_ROUTES, pathname)) return "auth";
  return firstRouteMatch(API_ROUTE_RULES, pathname);
}
