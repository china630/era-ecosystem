import {
  authCookieName,
  enterSatelliteTenant,
  jsonLoginHostBinding,
  openStaffLogin,
  satelliteRuntimeConfig,
  signSatelliteSession,
  verifySatelliteUserPassword,
} from "@era/satellite-kit";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { ensureSystemBankRoles } from "@/lib/auth/ensure-system-bank-roles";
import {
  ALL_PERMISSIONS,
  effectiveRolePermissions,
} from "@/lib/auth/permissions";
import { hasBankPermissionBypass } from "@/lib/auth/permission-check";

export async function POST(request: Request) {
  try {
    const opened = await openStaffLogin({
      request,
      isShared: satelliteRuntimeConfig().deploymentTopology === "SHARED",
    });
    if (!opened.ok) {
      return jsonError(opened.error, opened.status);
    }
    enterSatelliteTenant({ organizationId: opened.organizationId });

    const username = opened.login.trim();
    const user = await prisma.opsUser.findFirst({
      where: { organizationId: opened.organizationId, username },
      include: { opsRole: true },
    });

    if (
      !(await verifySatelliteUserPassword(opened.password, {
        passwordHash: user?.passwordHash ?? "",
        status: user?.status ?? "CLOSED",
      })) ||
      !user
    ) {
      return jsonError("Invalid credentials", 401);
    }

    await ensureSystemBankRoles(prisma, user.organizationId);

    const role = await prisma.opsRole.findUniqueOrThrow({
      where: { id: user.opsRoleId },
    });

    const bypass = hasBankPermissionBypass({
      login: user.username,
      role: role.code,
      isOwner: role.code === "BUSINESS_OWNER",
    });
    const permissions = bypass
      ? [...ALL_PERMISSIONS]
      : effectiveRolePermissions(role.code, role.permissionsJson);

    await prisma.opsSession.create({
      data: {
        opsUserId: user.id,
        branchId: user.branchId,
      },
    });

    const token = await signSatelliteSession({
      sub: user.id,
      login: user.username,
      role: role.code,
      fullName: user.fullName,
      organizationId: user.organizationId,
      permissions,
      isOwner: role.code === "BUSINESS_OWNER",
    });

    const res = jsonOk({
      user: {
        id: user.id,
        login: user.username,
        fullName: user.fullName,
        role: role.code,
        branchId: user.branchId,
        organizationId: user.organizationId,
        permissions,
      },
      token,
    });

    res.cookies.set(authCookieName(), token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 4,
    });

    return res;
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function GET(request: Request) {
  return jsonLoginHostBinding(request);
}
