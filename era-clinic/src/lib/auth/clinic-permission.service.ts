import { NextResponse } from "next/server";
import type { SatelliteSessionPayload } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";
import {
  effectiveRolePermissions,
  type ClinicPermission,
} from "@/lib/auth/clinic-permissions";
import {
  sessionHasClinicPermission,
  resolveSessionPermissions,
} from "@/lib/auth/clinic-permission-check";

export { sessionHasClinicPermission, resolveSessionPermissions };

function jsonForbidden(message: string) {
  return NextResponse.json({ error: message }, { status: 403 });
}

function jsonUnauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function permissionsForUser(userId: string): Promise<ClinicPermission[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });
  if (!user) return [];
  return effectiveRolePermissions(user.role.code, user.role.permissionsJson);
}

export async function permissionsForRoleCode(
  roleCode: string,
): Promise<ClinicPermission[]> {
  const role = await prisma.role.findFirst({ where: { code: roleCode } });
  if (!role) return effectiveRolePermissions(roleCode, "[]");
  return effectiveRolePermissions(role.code, role.permissionsJson);
}

export async function resolveEffectivePermissionsForUser(
  userId: string,
  session: SatelliteSessionPayload,
): Promise<ClinicPermission[]> {
  const perms = await permissionsForUser(userId);
  return resolveSessionPermissions({
    role: session.role,
    roles: session.roles,
    permissions: perms,
  });
}

/**
 * `session` comes from `getSatelliteSession`, which already reloaded the
 * grants from the DB; the JWT copy never reaches this check.
 */
export async function assertClinicPermission(
  session: SatelliteSessionPayload | null,
  permission: ClinicPermission,
): Promise<NextResponse | null> {
  if (!session) return jsonUnauthorized();
  if (!sessionHasClinicPermission(session, permission)) {
    return jsonForbidden("Forbidden");
  }
  return null;
}
