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
  "/api/integration/staff-provision",
  "/api/integration/settlement-confirmed",
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
  ["/api/receipts/*/lines/*/void", [P.RECEIPTS_VOID_LINE]],
  ["/api/receipts/*/void", [P.RECEIPTS_VOID_LINE]],
  ["/api/receipts", [P.RECEIPTS_SELL]],
  ["/api/receipts/*/apply-promo", [P.RECEIPTS_SELL]],
  ["/api/receipts/*/pay", [P.RECEIPTS_SELL]],
  ["/api/receipts/*/return", [P.RECEIPTS_SELL]],
  ["/api/receipts/*/bopis", [P.RECEIPTS_SELL]],
  ["/api/products/search", [P.RECEIPTS_SELL]],
  ["/api/shifts/open", [P.SHIFTS_OPEN]],
  ["/api/shifts/close", [P.SHIFTS_CLOSE]],
  ["/api/shifts/*/x-report", [P.SHIFTS_X_REPORT]],
  ["/api/stock/check", [P.STOCK_CHECK]],
  ["/api/presets", [P.PRESETS]],
  ["/api/offline/sync", [P.OFFLINE_SYNC]],
  ["/api/fiscal/devices", [P.FISCAL_DEVICES]],
  ["/api/uploads", [P.UPLOADS]],
  ["/api/integration/prescription-reserve", [P.INTEGRATIONS_STOCK]],
  ["/api/integration/stock-write-off", [P.INTEGRATIONS_STOCK]],
  ["/api/integrations/marketplace", [P.ADMIN_SETTINGS]],
  ["/api/import", [P.ADMIN_IMPORT]],
  ["/api/import/*", [P.ADMIN_IMPORT]],
  ["/api/replenishment/suggestions", [P.ADMIN_IMPORT]],
  ["/api/suppliers/invoices/match", [P.ADMIN_IMPORT]],
];

/** Grants for a staff API, `"auth"` for session-only routes, null when the route is not in the catalog. */
export function apiRoutePermissions(pathname: string): readonly Permission[] | "auth" | null {
  if (matchesAnyRoute(AUTH_ONLY_API_ROUTES, pathname)) return "auth";
  return firstRouteMatch(API_ROUTE_RULES, pathname);
}
