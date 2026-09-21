import { z } from "zod";
import { NextResponse } from "next/server";
import { assertBankEntitled, jsonOk, handleRouteError, jsonError } from "@/lib/api-utils";
import { getRouteSession } from "@/lib/api-utils";
import { assertPermission } from "@/lib/auth/require";
import {
  PERMISSIONS,
  effectiveRolePermissions,
  isBankPermission,
  isSystemBankRoleCode,
  parsePermissions,
  serializePermissions,
  type Permission,
} from "@/lib/auth/permissions";
import {
  BANK_PERMISSION_CATALOG_VERSION,
  templatePermissionsForReset,
} from "@/lib/auth/ensure-system-bank-roles";
import { prisma } from "@/lib/prisma";
import { permissionsForUserId } from "@/lib/auth/bank-permission.service";

const patchSchema = z.object({
  permissions: z.array(z.string()).optional(),
  resetToDefaults: z.boolean().optional(),
});

type RouteParams = { params: Promise<{ code: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  try {
    await assertBankEntitled();
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const sessionPerms = await permissionsForUserId(session.sub);
    assertPermission({ ...session, permissions: sessionPerms }, PERMISSIONS.ACCESS_MANAGE);

    const { code } = await params;
    const organizationId = session.organizationId;
    if (!organizationId) return jsonError("Unauthorized", 401);
    const role = await prisma.opsRole.findFirst({
      where: { organizationId, code },
    });
    if (!role) return jsonError("Role not found", 404);

    const permissions = effectiveRolePermissions(
      role.code,
      role.permissionsJson,
    );
    return jsonOk({
      code: role.code,
      name: role.name,
      isSystem: role.isSystem,
      cloneFromCode: role.cloneFromCode,
      permissions,
      customized: parsePermissions(role.permissionsJson).length > 0,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    await assertBankEntitled();
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const sessionPerms = await permissionsForUserId(session.sub);
    assertPermission({ ...session, permissions: sessionPerms }, PERMISSIONS.ACCESS_MANAGE);

    const { code } = await params;
    const organizationId = session.organizationId;
    if (!organizationId) return jsonError("Unauthorized", 401);
    const body = patchSchema.parse(await req.json());
    const role = await prisma.opsRole.findFirst({
      where: { organizationId, code },
    });
    if (!role) return jsonError("Role not found", 404);

    let next: Permission[];
    if (body.resetToDefaults) {
      next = templatePermissionsForReset(role);
      if (next.length === 0 && !isSystemBankRoleCode(code)) {
        return jsonError("No defaults available for this role", 400);
      }
    } else if (body.permissions) {
      const invalid = body.permissions.filter((p) => !isBankPermission(p));
      if (invalid.length > 0) {
        return NextResponse.json(
          { error: "Unknown permission codes", invalid },
          { status: 400 },
        );
      }
      next = body.permissions as Permission[];
    } else {
      return jsonError("permissions or resetToDefaults required", 400);
    }

    const updated = await prisma.opsRole.update({
      where: { id: role.id },
      data: {
        permissionsJson: serializePermissions(next),
        permissionCatalogVersion: BANK_PERMISSION_CATALOG_VERSION,
      },
    });

    return jsonOk({
      code: updated.code,
      permissions: parsePermissions(updated.permissionsJson),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
