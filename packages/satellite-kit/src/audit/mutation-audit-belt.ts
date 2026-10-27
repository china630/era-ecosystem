/**
 * Layer A HTTP mutation belt helpers — see docs/adr/era-mutation-audit-standard.md.
 * Middleware already stamps `x-era-method` / `x-era-pathname`; apps call
 * `scheduleHttpMutationAuditFromHeaders` from successful `jsonOk` responses.
 */

import {
  auditMutation,
  type MutationAuditContext,
  type SatelliteAuditWriter,
} from "./satellite-audit";

export const HTTP_MUTATION_ENTITY_TYPE = "HTTP_MUTATION";

export const HTTP_MUTATION_METHODS = new Set([
  "POST",
  "PATCH",
  "PUT",
  "DELETE",
]);

/** Baseline deny-list prefixes (path startsWith). Apps may append more. */
export const DEFAULT_MUTATION_AUDIT_EXEMPT_PREFIXES = [
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/sso/exchange",
  "/api/auth/agency-sso/exchange",
  "/api/auth/register",
  "/api/auth/refresh",
  "/api/health",
  "/api/ready",
  "/api/locale",
  "/api/early-access/events",
] as const;

export type ActorKind = "USER" | "SERVICE" | "WEBHOOK" | "SYSTEM" | "CRON" | "AGENCY";

export function isHttpMutationMethod(method: string | null | undefined): boolean {
  if (!method) return false;
  return HTTP_MUTATION_METHODS.has(method.trim().toUpperCase());
}

export function isMutationAuditExemptPath(
  pathname: string,
  extraPrefixes: readonly string[] = [],
): boolean {
  const path = pathname.split("?")[0] ?? pathname;
  const prefixes = [...DEFAULT_MUTATION_AUDIT_EXEMPT_PREFIXES, ...extraPrefixes];
  // Exact or child path only — do not treat `/api/health` as a prefix of `/api/healthcare`.
  return prefixes.some((p) => path === p || path.startsWith(`${p}/`));
}

/** Best-effort resource id from `/api/.../{uuid}` or last non-empty segment. */
export function inferMutationEntityId(pathname: string): string {
  const path = pathname.split("?")[0] ?? pathname;
  const uuid =
    path.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
    )?.[0] ?? null;
  if (uuid) return uuid;
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] || path || "-";
}

export function inferActorKind(opts: {
  pathname: string;
  userActorHeader?: string | null;
}): ActorKind {
  const path = opts.pathname;
  if (opts.userActorHeader === "agency") return "AGENCY";
  if (path.startsWith("/api/internal") || path.startsWith("/api/cron")) return "SERVICE";
  if (path.includes("/webhook") || path.includes("/webhooks")) return "WEBHOOK";
  if (path.includes("/cron")) return "CRON";
  return "USER";
}

export function buildHttpMutationChanges(input: {
  method: string;
  path: string;
  statusCode: number;
  actorKind: ActorKind;
  correlationId?: string | null;
}): Record<string, unknown> {
  return {
    method: input.method.toUpperCase(),
    path: input.path,
    statusCode: input.statusCode,
    actorKind: input.actorKind,
    ...(input.correlationId ? { correlationId: input.correlationId } : {}),
  };
}

export type HttpMutationAuditHeaderBag = {
  get(name: string): string | null;
};

export type ScheduleHttpMutationAuditDeps = {
  write: SatelliteAuditWriter;
  /** Extra deny-list prefixes for this product. */
  extraExemptPrefixes?: readonly string[];
  /** Resolve user id; default reads `x-user-id`. */
  resolveUserId?: (headers: HttpMutationAuditHeaderBag) => string | null;
  resolveIp?: (headers: HttpMutationAuditHeaderBag) => string | null;
};

/**
 * Fire-and-forget Layer A row after a successful mutation response.
 * Safe to call from `jsonOk`; never throws to the caller.
 */
export function scheduleHttpMutationAuditFromHeaders(
  headers: HttpMutationAuditHeaderBag,
  statusCode: number,
  deps: ScheduleHttpMutationAuditDeps,
): void {
  if (statusCode < 200 || statusCode >= 400) return;

  const method = headers.get("x-era-method")?.trim().toUpperCase() ?? "";
  const path = headers.get("x-era-pathname")?.trim() || "";
  if (!isHttpMutationMethod(method) || !path) return;
  if (isMutationAuditExemptPath(path, deps.extraExemptPrefixes)) return;

  const userId =
    deps.resolveUserId?.(headers) ?? headers.get("x-user-id")?.trim() ?? null;
  const ip =
    deps.resolveIp?.(headers) ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip");
  const actorKind = inferActorKind({
    pathname: path,
    userActorHeader: headers.get("x-user-actor"),
  });
  const entityId = inferMutationEntityId(path);
  const changes = buildHttpMutationChanges({
    method,
    path,
    statusCode,
    actorKind,
    correlationId: headers.get("x-request-id") ?? headers.get("x-correlation-id"),
  });

  void auditMutation(
    deps.write,
    { userId, ipAddress: ip } satisfies MutationAuditContext,
    HTTP_MUTATION_ENTITY_TYPE,
    entityId,
    method,
    changes,
  );
}

export type MutationAuditHandler = (
  request: Request,
  context?: unknown,
) => Promise<Response> | Response;

/**
 * Explicit wrapper when an app cannot hook `jsonOk` (or for tests).
 * Records Layer A only for 2xx/3xx responses.
 */
export function withMutationAudit(
  handler: MutationAuditHandler,
  deps: ScheduleHttpMutationAuditDeps & {
    getUserId?: (request: Request) => string | null | Promise<string | null>;
  },
): MutationAuditHandler {
  return async (request, context) => {
    const response = await handler(request, context);
    const status = response.status;
    if (status >= 200 && status < 400) {
      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method.toUpperCase();
      if (
        isHttpMutationMethod(method) &&
        !isMutationAuditExemptPath(path, deps.extraExemptPrefixes)
      ) {
        const userId = (await deps.getUserId?.(request)) ?? null;
        const ip =
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          request.headers.get("x-real-ip");
        void auditMutation(
          deps.write,
          { userId, ipAddress: ip },
          HTTP_MUTATION_ENTITY_TYPE,
          inferMutationEntityId(path),
          method,
          buildHttpMutationChanges({
            method,
            path,
            statusCode: status,
            actorKind: inferActorKind({
              pathname: path,
              userActorHeader: request.headers.get("x-user-actor"),
            }),
          }),
        );
      }
    }
    return response;
  };
}
