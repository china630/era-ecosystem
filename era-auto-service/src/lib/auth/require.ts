import { apiRoutePermissions } from "@/lib/auth/api-route-permissions";
import {
  sessionHasAnyPermission,
  sessionHasPermission,
  type PermissionSession,
} from "@/lib/auth/permission-check";
import type { Permission } from "@/lib/auth/permissions";

export class UnauthorizedError extends Error {
  readonly status = 401;
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class PermissionDeniedError extends Error {
  readonly status = 403;
  constructor(message = "Forbidden: insufficient permissions") {
    super(message);
    this.name = "PermissionDeniedError";
  }
}

export function assertPermission(
  session: PermissionSession | null | undefined,
  permission: Permission,
): asserts session is PermissionSession {
  if (!session) throw new UnauthorizedError();
  if (!sessionHasPermission(session, permission)) {
    throw new PermissionDeniedError(`Forbidden: ${permission} required`);
  }
}

export function assertAnyPermission(
  session: PermissionSession | null | undefined,
  permissions: readonly Permission[],
): asserts session is PermissionSession {
  if (!session) throw new UnauthorizedError();
  if (!sessionHasAnyPermission(session, permissions)) {
    throw new PermissionDeniedError(`Forbidden: one of ${permissions.join(", ")} required`);
  }
}

/**
 * Staff API door for the path the middleware stamped. A path outside `/api/`
 * is a server component and passes. A missing path denies: staff middleware
 * always stamps `x-era-pathname` on a real request.
 */
export function assertApiRouteGrant(
  session: PermissionSession,
  pathname: string | null | undefined,
): void {
  if (pathname && !pathname.startsWith("/api/")) return;
  if (!pathname?.startsWith("/api/")) {
    throw new PermissionDeniedError("Forbidden: API path was not stamped");
  }
  const required = apiRoutePermissions(pathname);
  if (required === "auth") return;
  if (required === null) {
    throw new PermissionDeniedError("Forbidden: route is not in the permission catalog");
  }
  assertAnyPermission(session, required);
}
