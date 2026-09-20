import { z } from "zod";
import { NextResponse } from "next/server";
import { assertFnbEntitled, jsonOk, handleRouteError, jsonError } from "@/lib/api-utils";
import { getSessionFromRequest } from "@/lib/session";
import { assertPermission } from "@/lib/auth/require";
import {
  PERMISSIONS,
  effectiveRolePermissions,
  isFnbPermission,
  isSystemFnbRoleCode,
  parsePermissions,
  serializePermissions,
  type Permission,
} from "@/lib/auth/permissions";
import {
  FNB_PERMISSION_CATALOG_VERSION,
  templatePermissionsForReset,
} from "@/lib/auth/ensure-system-fnb-roles";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { recordFbAudit } from "@/lib/satellite-audit";
import { editionForOrg } from "@/lib/auth/fnb-permission.service";

const patchSchema = z.object({
  permissions: z.array(z.string()).optional(),
  resetToDefaults: z.boolean().optional(),
});

type RouteParams = { params: Promise<{ code: string }> };

export async function GET(req: Request, { params }: RouteParams) {
  try {
    await assertFnbEntitled();
    const session = await getSessionFromRequest(req);
    assertPermission(session, PERMISSIONS.ACCESS_MANAGE);

    const { code } = await params;
    const organizationId = requestOrganizationId();
    const edition = await editionForOrg(organizationId);
    const role = await prisma.role.findFirst({
      where: { organizationId, code },
    });
    if (!role) return jsonError("Role not found", 404);

    const permissions = effectiveRolePermissions(
      role.code,
      role.permissionsJson,
      edition,
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
    await assertFnbEntitled();
    const session = await getSessionFromRequest(req);
    assertPermission(session, PERMISSIONS.ACCESS_MANAGE);

    const { code } = await params;
    const organizationId = requestOrganizationId();
    const edition = await editionForOrg(organizationId);
    const body = patchSchema.parse(await req.json());
    const role = await prisma.role.findFirst({
      where: { organizationId, code },
    });
    if (!role) return jsonError("Role not found", 404);

    let next: Permission[];
    if (body.resetToDefaults) {
      next = templatePermissionsForReset(role, edition);
      if (next.length === 0 && !isSystemFnbRoleCode(code)) {
        return jsonError("No defaults available for this role", 400);
      }
    } else if (body.permissions) {
      const invalid = body.permissions.filter((p) => !isFnbPermission(p));
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

    const before = parsePermissions(role.permissionsJson);
    const updated = await prisma.role.update({
      where: { id: role.id },
      data: {
        permissionsJson: serializePermissions(next),
        permissionCatalogVersion: FNB_PERMISSION_CATALOG_VERSION,
      },
    });

    await recordFbAudit(
      { userId: session!.sub, request: req },
      "Role",
      role.id,
      "ROLE_PERMISSIONS_PATCH",
      {
        code: role.code,
        before,
        after: next,
        resetToDefaults: body.resetToDefaults === true,
      },
    );

    return jsonOk({
      code: updated.code,
      permissions: parsePermissions(updated.permissionsJson),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
