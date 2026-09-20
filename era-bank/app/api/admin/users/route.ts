import { z } from "zod";
import { assertBankEntitled, jsonOk, handleRouteError, jsonError } from "@/lib/api-utils";
import { getRouteSession } from "@/lib/api-utils";
import { assertAnyPermission } from "@/lib/auth/require";
import { PERMISSIONS, resolveBankRoleCode } from "@/lib/auth/permissions";
import { ensureSystemBankRoles } from "@/lib/auth/ensure-system-bank-roles";
import { prisma } from "@/lib/prisma";
import { permissionsForUserId } from "@/lib/auth/bank-permission.service";

const patchSchema = z.object({
  userId: z.string().min(1),
  roleCode: z.string().trim().min(1).max(64),
});

export async function GET() {
  try {
    await assertBankEntitled();
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const permissions = await permissionsForUserId(session.sub);
    assertAnyPermission(
      { ...session, permissions },
      [PERMISSIONS.USERS, PERMISSIONS.ACCESS_MANAGE],
    );

    const organizationId = session.organizationId;
    if (!organizationId) return jsonError("Unauthorized", 401);
    await ensureSystemBankRoles(prisma, organizationId);

    const users = await prisma.opsUser.findMany({
      where: { organizationId },
      orderBy: { username: "asc" },
      include: { opsRole: { select: { code: true, name: true } } },
    });

    return jsonOk(
      users.map((u) => ({
        id: u.id,
        username: u.username,
        fullName: u.fullName,
        status: u.status,
        branchId: u.branchId,
        roleCode: u.opsRole.code,
        roleName: u.opsRole.name,
      })),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    await assertBankEntitled();
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const permissions = await permissionsForUserId(session.sub);
    assertAnyPermission(
      { ...session, permissions },
      [PERMISSIONS.USERS, PERMISSIONS.ACCESS_MANAGE],
    );

    const organizationId = session.organizationId;
    if (!organizationId) return jsonError("Unauthorized", 401);
    await ensureSystemBankRoles(prisma, organizationId);

    const body = patchSchema.parse(await req.json());
    const resolved = resolveBankRoleCode(body.roleCode);
    const code = resolved ?? body.roleCode.trim().toUpperCase();
    const role = await prisma.opsRole.findFirst({
      where: { organizationId, code },
    });
    if (!role) {
      return jsonError("Unknown role code", 400);
    }

    const user = await prisma.opsUser.findFirst({
      where: { id: body.userId, organizationId },
    });
    if (!user) return jsonError("User not found", 404);

    const updated = await prisma.opsUser.update({
      where: { id: user.id },
      data: { opsRoleId: role.id },
      include: { opsRole: { select: { code: true, name: true } } },
    });

    return jsonOk({
      id: updated.id,
      username: updated.username,
      roleCode: updated.opsRole.code,
      roleName: updated.opsRole.name,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
