import type { Permission } from "@/lib/auth/permissions";
import {
  sessionHasBankPermission,
  type BankPermissionSession,
} from "@/lib/auth/permission-check";
import type { SatelliteSessionPayload } from "@era/satellite-kit";

function toCheckSession(
  session: SatelliteSessionPayload | BankPermissionSession,
): BankPermissionSession {
  return {
    login: session.login,
    email: session.email,
    role: session.role,
    permissions: session.permissions,
    isOwner: session.isOwner,
  };
}

export function assertPermission(
  session: SatelliteSessionPayload | BankPermissionSession | null,
  permission: Permission,
): void {
  if (!session) throw new Error("Unauthorized");
  if (!sessionHasBankPermission(toCheckSession(session), permission)) {
    throw new Error("Forbidden: insufficient permissions");
  }
}

export function assertAnyPermission(
  session: SatelliteSessionPayload | BankPermissionSession | null,
  permissions: Permission[],
): void {
  if (!session) throw new Error("Unauthorized");
  const check = toCheckSession(session);
  if (!permissions.some((p) => sessionHasBankPermission(check, p))) {
    throw new Error("Forbidden: insufficient permissions");
  }
}

export function denyUnlessPermission(
  session: SatelliteSessionPayload | null,
  permission: Permission,
): Response | null {
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!sessionHasBankPermission(toCheckSession(session), permission)) {
    return new Response(
      JSON.stringify({ error: "Forbidden: insufficient permissions" }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
  return null;
}

export function denyUnlessAnyPermission(
  session: SatelliteSessionPayload | null,
  permissions: Permission[],
): Response | null {
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const check = toCheckSession(session);
  if (!permissions.some((p) => sessionHasBankPermission(check, p))) {
    return new Response(
      JSON.stringify({ error: "Forbidden: insufficient permissions" }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
  return null;
}
