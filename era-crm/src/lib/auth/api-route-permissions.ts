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
  "/api/integrations/hooks/**",
  "/api/integrations/ics/**",
  "/api/public/platform-links",
  // challenge is under hooks/* — covered by hooks/** above
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
  ["/api/admin/links", [P.ADMIN_PIPELINE]],
  ["/api/admin/convert-settings", [P.ADMIN_PIPELINE]],
  ["/api/admin/webhooks*", [P.ADMIN_INTEGRATIONS]],
  ["/api/admin/api-keys*", [P.ADMIN_INTEGRATIONS]],
  ["/api/admin/**", [P.ACCESS_MANAGE]],
  ["/api/integrations/catalog", [P.SCREEN_ADMIN_INTEGRATIONS, P.ADMIN_INTEGRATIONS]],
  ["/api/integrations/connections*", [P.ADMIN_INTEGRATIONS]],
  ["/api/integrations/outbox*", [P.ADMIN_INTEGRATIONS]],
  ["/api/integrations/oauth/**", [P.ADMIN_INTEGRATIONS]],
  ["/api/leads/import", [P.ADMIN_IMPORT]],
  ["/api/leads/import/*", [P.ADMIN_IMPORT]],
  ["/api/leads/merge", [P.LEADS_WRITE, P.LEADS_ASSIGN]],
  ["/api/leads/next-contact-due", [P.LEADS_READ]],
  ["/api/leads", [P.LEADS_READ, P.LEADS_WRITE]],
  ["/api/leads/*/assign", [P.LEADS_ASSIGN]],
  ["/api/leads/*/stage", [P.LEADS_STAGE]],
  ["/api/leads/*/convert", [P.LEADS_CONVERT]],
  ["/api/leads/*/follow-up", [P.LEADS_FOLLOW_UP]],
  ["/api/leads/*/score", [P.LEADS_WRITE]],
  ["/api/leads/*/warranty-cases", [P.LEADS_WRITE]],
  ["/api/leads/*/activities", [P.LEADS_READ]],
  ["/api/leads/*/custom", [P.LEADS_WRITE]],
  ["/api/leads/*/payment", [P.LEADS_READ, P.LEADS_WRITE]],
  ["/api/leads/*/tags", [P.LEADS_READ, P.LEADS_WRITE]],
  ["/api/leads/*/tags/*", [P.LEADS_WRITE]],
  ["/api/unsorted", [P.LEADS_READ, P.LEADS_WRITE]],
  ["/api/unsorted/*", [P.LEADS_WRITE, P.LEADS_ASSIGN]],
  ["/api/selection-packages/*", [P.LEADS_WRITE]],
  ["/api/warranty-cases/*", [P.LEADS_WRITE]],
  ["/api/companies", [P.LEADS_READ, P.LEADS_WRITE]],
  ["/api/contacts", [P.LEADS_READ, P.LEADS_WRITE]],
  ["/api/custom-fields", [P.ADMIN_PIPELINE, P.LEADS_READ, P.LEADS_WRITE]],
  ["/api/tags", [P.LEADS_READ]],
  ["/api/sales-goals", [P.SCREEN_REPORTS, P.ADMIN_PIPELINE]],
  ["/api/sales-goals/*", [P.SCREEN_REPORTS, P.ADMIN_PIPELINE]],
  ["/api/leads/*", [P.LEADS_READ, P.LEADS_WRITE]],
  ["/api/counterparties/voen-preview", [P.LEADS_READ]],
  ["/api/mdm/person-lookup", [P.LEADS_WRITE]],
  ["/api/mdm/voen-lookup", [P.LEADS_WRITE, P.ADMIN_PIPELINE]],
  ["/api/inbox", [P.INBOX, P.CONVERSATIONS_READ]],
  ["/api/conversations", [P.CONVERSATIONS_READ, P.CONVERSATIONS_WRITE]],
  ["/api/conversations/*", [P.CONVERSATIONS_READ, P.CONVERSATIONS_WRITE]],
  ["/api/calls", [P.CALLS_READ]],
  ["/api/calls/originate", [P.CALLS_ORIGINATE]],
  ["/api/calls/*", [P.CALLS_READ, P.CALLS_RECORDINGS]],
  ["/api/realtime/calls", [P.CALLS_READ]],
  ["/api/tasks", [P.TASKS_READ, P.TASKS_WRITE]],
  ["/api/tasks/*", [P.TASKS_READ, P.TASKS_WRITE]],
  ["/api/reports/**", [P.SCREEN_REPORTS]],
  ["/api/visits", [P.VISITS]],
  ["/api/lookups", [P.LOOKUPS]],
  ["/api/lookups/*", [P.LOOKUPS]],
  ["/api/users", [P.USERS_LIST]],
  ["/api/pipeline/rules", [P.ADMIN_PIPELINE]],
  ["/api/pipeline/rules/*", [P.ADMIN_PIPELINE]],
  // GET board/detail: LEADS_READ; mutations assert ADMIN_PIPELINE in handler.
  ["/api/pipelines*", [P.ADMIN_PIPELINE, P.LEADS_READ]],
];

/** Grants for a staff API, `"auth"` for session-only routes, null when the route is not in the catalog. */
export function apiRoutePermissions(pathname: string): readonly Permission[] | "auth" | null {
  if (matchesAnyRoute(AUTH_ONLY_API_ROUTES, pathname)) return "auth";
  return firstRouteMatch(API_ROUTE_RULES, pathname);
}
