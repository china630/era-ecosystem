import { z } from "zod";
import { NextResponse } from "next/server";
import { jsonOk, handleRouteError, jsonError, getSatelliteSession } from "@/lib/api-utils";
import { assertPermission } from "@/lib/auth/require";
import { PERMISSIONS, PERMISSION_CATALOG_VERSION, type Permission } from "@/lib/auth/permissions";
import {
  effectiveRolePermissions,
  isPermission,
  isSystemRoleCode,
  parsePermissions,
  serializePermissions,
} from "@/lib/auth/permission-catalog";
import { templatePermissionsForReset } from "@/lib/auth/ensure-system-wholesale-roles";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/satellite-audit";

const patchSchema = z.object({
  permissions: z.array(z.string()).optional(),
  resetToDefaults: z.boolean().optional(),
});

type RouteParams = { params: Promise<{ code: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.ACCESS_MANAGE);
    const { code } = await params;
    const role = await prisma.role.findFirst({
      where: { organizationId: session.organizationId, code },
    });
    if (!role) return jsonError("Role not found", 404);

    return jsonOk({
      code: role.code,
      name: role.name,
      isSystem: role.isSystem,
      cloneFromCode: role.cloneFromCode,
      permissions: effectiveRolePermissions(role),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.ACCESS_MANAGE);
    const { code } = await params;
    const body = patchSchema.parse(await req.json());
    const role = await prisma.role.findFirst({
      where: { organizationId: session.organizationId, code },
    });
    if (!role) return jsonError("Role not found", 404);

    let next: Permission[];
    if (body.resetToDefaults) {
      next = templatePermissionsForReset(role);
      if (next.length === 0 && !isSystemRoleCode(role.code)) {
        return jsonError("No defaults available for this role", 400);
      }
    } else if (body.permissions) {
      const invalid = body.permissions.filter((p) => !isPermission(p));
      if (invalid.length > 0) {
        return NextResponse.json({ error: "Unknown permission codes", invalid }, { status: 400 });
      }
      next = body.permissions as Permission[];
    } else {
      return jsonError("permissions or resetToDefaults required", 400);
    }

    const before = effectiveRolePermissions(role);
    const updated = await prisma.role.update({
      where: { id: role.id },
      data: {
        permissionsJson: serializePermissions(next),
        permissionCatalogVersion: PERMISSION_CATALOG_VERSION,
      },
    });
    await recordAudit(
      { userId: session.sub, request: req },
      "Role",
      role.id,
      "ROLE_PERMISSIONS_PATCH",
      { code: role.code, before, after: next, resetToDefaults: body.resetToDefaults === true },
    );

    return jsonOk({ code: updated.code, permissions: parsePermissions(updated.permissionsJson) });
  } catch (err) {
    return handleRouteError(err);
  }
}
