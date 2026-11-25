import type { Permission } from "@/lib/auth/permissions";
import {
  sessionHasFnbPermission,
  type FnbPermissionSession,
} from "@/lib/auth/permission-check";
import { roleForbiddenBody, type SatelliteSessionPayload } from "@era/satellite-kit";

function toCheckSession(
  session: SatelliteSessionPayload | FnbPermissionSession,
): FnbPermissionSession {
  return {
    login: session.login,
    email: session.email,
    role: session.role,
    permissions: session.permissions,
    isOwner: session.isOwner,
    pin: session.pin,
  };
}

export function assertPermission<S extends SatelliteSessionPayload | FnbPermissionSession>(
  session: S | null,
  permission: Permission,
): asserts session is S {
  if (!session) throw new Error("Unauthorized");
  if (!sessionHasFnbPermission(toCheckSession(session), permission)) {
    throw new Error("Forbidden: insufficient permissions");
  }
}

export function assertAnyPermission<S extends SatelliteSessionPayload | FnbPermissionSession>(
  session: S | null,
  permissions: Permission[],
): asserts session is S {
  if (!session) throw new Error("Unauthorized");
  const check = toCheckSession(session);
  if (!permissions.some((p) => sessionHasFnbPermission(check, p))) {
    throw new Error("Forbidden: insufficient permissions");
  }
}

/** Response helpers for route handlers that prefer Response over throw. */
export function denyUnlessPermission(
  session: SatelliteSessionPayload | null,
  permission: Permission,
): { status: number; body: unknown } | null {
  if (!session) return { status: 401, body: { error: "Unauthorized" } };
  if (!sessionHasFnbPermission(toCheckSession(session), permission)) {
    return { status: 403, body: roleForbiddenBody("Forbidden: insufficient permissions") };
  }
  return null;
}

export function denyUnlessAnyPermission(
  session: SatelliteSessionPayload | null,
  permissions: Permission[],
): { status: number; body: unknown } | null {
  if (!session) return { status: 401, body: { error: "Unauthorized" } };
  const check = toCheckSession(session);
  if (!permissions.some((p) => sessionHasFnbPermission(check, p))) {
    return { status: 403, body: roleForbiddenBody("Forbidden: insufficient permissions") };
  }
  return null;
}
