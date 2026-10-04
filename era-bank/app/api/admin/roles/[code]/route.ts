import { z } from "zod";
import { NextResponse } from "next/server";
import { jsonOk, handleRouteError, jsonError } from "@/lib/api-utils";
import { getSatelliteSession } from "@/lib/api-utils";
import { assertPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  canDeleteBankRole,
  canMutateCustomRoleMeta,
} from "@/lib/auth/bank-role-admin";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ code: string }> };

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const session = await getSatelliteSession();
    if (!session) return jsonError("Unauthorized", 401);
    assertPermission(session, PERMISSIONS.ACCESS_MANAGE);

    const { code } = await params;
    const organizationId = session.organizationId;
    if (!organizationId) return jsonError("Unauthorized", 401);
    const body = patchSchema.parse(await req.json());

    const role = await prisma.opsRole.findFirst({
      where: { organizationId, code },
    });
    if (!role) return jsonError("Role not found", 404);

    if (!canMutateCustomRoleMeta(role)) {
      return jsonError("Cannot rename a system role", 400);
    }

    const updated = await prisma.opsRole.update({
      where: { id: role.id },
      data: { name: body.name },
    });

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

export async function DELETE(_req: Request, { params }: RouteParams) {
  try {
    const session = await getSatelliteSession();
    if (!session) return jsonError("Unauthorized", 401);
    assertPermission(session, PERMISSIONS.ACCESS_MANAGE);

    const { code } = await params;
    const organizationId = session.organizationId;
    if (!organizationId) return jsonError("Unauthorized", 401);
    const role = await prisma.opsRole.findFirst({
      where: { organizationId, code },
      include: { _count: { select: { users: true } } },
    });
    if (!role) return jsonError("Role not found", 404);
    const deletable = canDeleteBankRole({
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

    await prisma.opsRole.delete({ where: { id: role.id } });
    return jsonOk({ deleted: true, code: role.code });
  } catch (err) {
    return handleRouteError(err);
  }
}
