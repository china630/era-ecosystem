import { z } from "zod";
import { hashPassword } from "@era/satellite-kit";
import { jsonOk, handleRouteError, jsonError, getSatelliteSession } from "@/lib/api-utils";
import { assertPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { hasPermissionBypass } from "@/lib/auth/permission-check";
import { normalizeRoleCode, roleAssignDenied } from "@/lib/auth/retail-role-admin";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/satellite-audit";

const patchSchema = z.object({
  userId: z.string().trim().min(1),
  roleCode: z.string().trim().min(1).max(64).optional(),
  status: z.enum(["ACTIVE", "DISABLED"]).optional(),
  fullName: z.string().trim().min(1).max(200).optional(),
});

const createSchema = z.object({
  login: z.string().trim().min(1).max(64),
  fullName: z.string().trim().min(1).max(200),
  password: z.string().min(4).max(128),
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
        isCrossSystem: true,
        cpEmploymentId: true,
        positionTitle: true,
        role: { select: { code: true, name: true } },
      },
    });
    return jsonOk(
      users.map((u) => ({
        id: u.id,
        login: u.login,
        fullName: u.fullName,
        status: u.status,
        isCrossSystem: u.isCrossSystem,
        cpEmploymentId: u.cpEmploymentId,
        positionTitle: u.positionTitle,
        role: u.role.name || u.role.code,
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
    const roleCode = body.roleCode ? normalizeRoleCode(body.roleCode) : null;

    const role = roleCode
      ? await prisma.role.findFirst({ where: { organizationId, code: roleCode } })
      : null;
    if (roleCode && !role) return jsonError("Unknown role code", 400);
    const user = await prisma.user.findFirst({
      where: { id: body.userId, organizationId },
      include: { role: { select: { code: true } } },
    });
    if (!user) return jsonError("User not found", 404);

    if (role) {
      const denied = roleAssignDenied({
        actorBypass: hasPermissionBypass(session),
        fromRoleCode: user.role.code,
        toRoleCode: role.code,
      });
      if (denied) return jsonError(denied, 403);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(role ? { roleId: role.id } : {}),
        ...(body.status ? { status: body.status } : {}),
        ...(body.fullName && !user.cpEmploymentId ? { fullName: body.fullName } : {}),
      },
    });
    await recordAudit({ userId: session.sub, request: req }, "User", user.id, "USER_UPDATE", {
      before: user.role.code,
      after: role?.code ?? user.role.code,
      status: body.status ?? user.status,
    });

    return jsonOk({
      userId: user.id,
      roleCode: role?.code ?? user.role.code,
      status: body.status ?? user.status,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.ACCESS_MANAGE);
    const organizationId = session.organizationId;
    const body = createSchema.parse(await req.json());
    const roleCode = normalizeRoleCode(body.roleCode);
    const role = await prisma.role.findFirst({ where: { organizationId, code: roleCode } });
    if (!role) return jsonError("Unknown role code", 400);
    const denied = roleAssignDenied({
      actorBypass: hasPermissionBypass(session),
      fromRoleCode: role.code,
      toRoleCode: role.code,
    });
    if (denied) return jsonError(denied, 403);
    const existing = await prisma.user.findFirst({
      where: { organizationId, login: body.login },
      select: { id: true },
    });
    if (existing) return jsonError("Login already taken", 409);
    const passwordHash = await hashPassword(body.password);
    const user = await prisma.user.create({
      data: {
        organizationId,
        login: body.login,
        fullName: body.fullName,
        passwordHash,
        roleId: role.id,
        status: "ACTIVE",
      },
    });
    await recordAudit({ userId: session.sub, request: req }, "User", user.id, "USER_CREATE", {
      login: user.login,
      roleCode: role.code,
    });
    return jsonOk({ id: user.id, login: user.login, roleCode: role.code });
  } catch (err) {
    return handleRouteError(err);
  }
}
