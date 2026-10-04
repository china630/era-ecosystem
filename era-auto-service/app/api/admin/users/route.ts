import { z } from "zod";
import { jsonOk, handleRouteError, jsonError, getSatelliteSession } from "@/lib/api-utils";
import { assertPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { hasPermissionBypass } from "@/lib/auth/permission-check";
import { normalizeRoleCode, roleAssignDenied } from "@/lib/auth/auto-role-admin";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/satellite-audit";

const patchSchema = z.object({
  userId: z.string().trim().min(1),
  roleCode: z.string().trim().min(1).max(64),
});

export async function GET() {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.ACCESS_MANAGE);
    const users = await prisma.user.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { login: "asc" },
      select: {
        id: true,
        login: true,
        fullName: true,
        status: true,
        role: { select: { code: true } },
      },
    });
    return jsonOk(
      users.map((u) => ({
        id: u.id,
        login: u.login,
        fullName: u.fullName,
        status: u.status,
        roleCode: u.role.code,
      })),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.ACCESS_MANAGE);
    const organizationId = session.organizationId;
    const body = patchSchema.parse(await req.json());
    const roleCode = normalizeRoleCode(body.roleCode);

    const role = await prisma.role.findFirst({ where: { organizationId, code: roleCode } });
    if (!role) return jsonError("Unknown role code", 400);
    const user = await prisma.user.findFirst({
      where: { id: body.userId, organizationId },
      include: { role: { select: { code: true } } },
    });
    if (!user) return jsonError("User not found", 404);

    const denied = roleAssignDenied({
      actorBypass: hasPermissionBypass(session),
      fromRoleCode: user.role.code,
      toRoleCode: role.code,
    });
    if (denied) return jsonError(denied, 403);

    await prisma.user.update({ where: { id: user.id }, data: { roleId: role.id } });
    await recordAudit({ userId: session.sub, request: req }, "User", user.id, "USER_ROLE_ASSIGN", {
      before: user.role.code,
      after: role.code,
    });

    return jsonOk({ userId: user.id, roleCode: role.code });
  } catch (err) {
    return handleRouteError(err);
  }
}
