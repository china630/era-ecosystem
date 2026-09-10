import { z } from "zod";
import { NextResponse } from "next/server";
import { jsonOk, handleRouteError, jsonError } from "@/lib/api-utils";
import { getSessionFromHeaders } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/require";
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  effectiveRolePermissions,
  isHotelPermission,
  parsePermissions,
  serializePermissions,
  type Permission,
  type RoleCode,
} from "@/lib/auth/permissions";
import { isSystemHotelRoleCode } from "@/lib/hotel-roles";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { recordHotelAudit } from "@/lib/satellite-audit";

const patchSchema = z.object({
  permissions: z.array(z.string()).optional(),
  resetToDefaults: z.boolean().optional(),
});

type RouteParams = { params: Promise<{ code: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.ACCESS_MANAGE);

    const { code } = await params;
    const organizationId = requestOrganizationId();
    const role = await prisma.role.findFirst({
      where: { organizationId, code },
    });
    if (!role) return jsonError("Role not found", 404);

    const permissions = effectiveRolePermissions(role.code, role.permissionsJson);
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
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.ACCESS_MANAGE);

    const { code } = await params;
    const organizationId = requestOrganizationId();
    const body = patchSchema.parse(await req.json());
    const role = await prisma.role.findFirst({
      where: { organizationId, code },
    });
    if (!role) return jsonError("Role not found", 404);

    let next: Permission[];
    if (body.resetToDefaults) {
      if (isSystemHotelRoleCode(code) && ROLE_PERMISSIONS[code as RoleCode]) {
        next = [...ROLE_PERMISSIONS[code as RoleCode]];
      } else if (role.cloneFromCode) {
        const donor = await prisma.role.findFirst({
          where: { organizationId, code: role.cloneFromCode },
        });
        if (!donor) {
          return jsonError("cloneFrom role missing; cannot reset", 400);
        }
        next = effectiveRolePermissions(donor.code, donor.permissionsJson);
      } else {
        return jsonError("No defaults available for this role", 400);
      }
    } else if (body.permissions) {
      const invalid = body.permissions.filter((p) => !isHotelPermission(p));
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
      data: { permissionsJson: serializePermissions(next) },
    });

    await recordHotelAudit(
      { userId: session!.sub, request: req },
      "Role",
      role.id,
      "PERMISSIONS_UPDATE",
      {
        roleCode: code,
        before,
        after: next,
        resetToDefaults: body.resetToDefaults === true,
      },
    );

    return jsonOk({
      code: updated.code,
      permissions: next,
      customized: true,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
