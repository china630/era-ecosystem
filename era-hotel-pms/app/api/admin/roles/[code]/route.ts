import { z } from "zod";
import { NextResponse } from "next/server";
import { jsonOk, handleRouteError, jsonError } from "@/lib/api-utils";
import { getSessionFromHeaders } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  canDeleteHotelRole,
  canMutateCustomRoleMeta,
} from "@/lib/auth/hotel-role-admin";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { recordHotelAudit } from "@/lib/satellite-audit";

type RouteParams = { params: Promise<{ code: string }> };

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

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

    if (!canMutateCustomRoleMeta(role)) {
      return jsonError("Cannot rename a system role", 400);
    }

    const before = { name: role.name };
    const updated = await prisma.role.update({
      where: { id: role.id },
      data: { name: body.name },
    });

    await recordHotelAudit(
      { userId: session!.sub, request: req },
      "Role",
      role.id,
      "ROLE_UPDATE",
      { code: role.code, before, after: { name: updated.name } },
    );

    return jsonOk({
      code: updated.code,
      name: updated.name,
      isSystem: updated.isSystem,
      cloneFromCode: updated.cloneFromCode,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.ACCESS_MANAGE);

    const { code } = await params;
    const organizationId = requestOrganizationId();
    const role = await prisma.role.findFirst({
      where: { organizationId, code },
      include: { _count: { select: { users: true } } },
    });
    if (!role) return jsonError("Role not found", 404);
    const deletable = canDeleteHotelRole({
      isSystem: role.isSystem,
      code: role.code,
      userCount: role._count.users,
    });
    if (!deletable.ok) {
      if (deletable.reason === "system") {
        return jsonError("Cannot delete a system role", 400);
      }
      return NextResponse.json(
        { error: "Role still has users", userCount: role._count.users },
        { status: 409 },
      );
    }

    await prisma.role.delete({ where: { id: role.id } });
    await recordHotelAudit(
      { userId: session!.sub, request: req },
      "Role",
      role.id,
      "ROLE_DELETE",
      { code: role.code, name: role.name },
    );

    return jsonOk({ deleted: true, code: role.code });
  } catch (err) {
    return handleRouteError(err);
  }
}
