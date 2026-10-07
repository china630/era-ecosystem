import {
  authCookieName,
  authenticateIndustryStaffLogin,
  isSatelliteUserLoginAllowed,
  jsonLoginHostBinding,
  satelliteRuntimeConfig,
  signSatelliteSession,
} from "@era/satellite-kit";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import {
  ensureSystemFnbRoles,
  resolveFnbEdition,
} from "@/lib/auth/ensure-system-fnb-roles";
import { getFnbOrgProfile } from "@/lib/fnb-org-profile";
import {
  ALL_PERMISSIONS,
  effectiveRolePermissions,
} from "@/lib/auth/permissions";
import { hasFnbPermissionBypass } from "@/lib/auth/permission-check";

export async function POST(request: Request) {
  try {
    const auth = await authenticateIndustryStaffLogin({
      request,
      prisma,
      isShared: satelliteRuntimeConfig().deploymentTopology === "SHARED",
    });
    if (!auth.ok) {
      return jsonError(auth.error, auth.status);
    }
    const user = auth.user;
    const organizationId = auth.organizationId;

    const profile = await getFnbOrgProfile(organizationId);
    const edition = resolveFnbEdition(profile.edition);
    await ensureSystemFnbRoles(prisma, organizationId, edition);

    const refreshed = await prisma.user.findUnique({
      where: { id: user.id },
      include: { role: true },
    });
    if (!refreshed || !isSatelliteUserLoginAllowed(refreshed)) {
      return jsonError("Invalid credentials", 401);
    }

    await prisma.user.update({
      where: { id: refreshed.id },
      data: { lastLoginAt: new Date() },
    });

    const bypass = hasFnbPermissionBypass({
      login: refreshed.login,
      email: refreshed.email ?? undefined,
      role: refreshed.role.code,
      isOwner: false,
    });
    const permissions = bypass
      ? [...ALL_PERMISSIONS]
      : effectiveRolePermissions(
          refreshed.role.code,
          refreshed.role.permissionsJson,
          edition,
        );

    const token = await signSatelliteSession({
      sub: refreshed.id,
      login: refreshed.login,
      email: refreshed.email ?? undefined,
      role: refreshed.role.code,
      fullName: refreshed.fullName,
      organizationId,
      permissions,
    });
    const res = jsonOk({
      user: {
        id: refreshed.id,
        login: refreshed.login,
        fullName: refreshed.fullName,
        role: refreshed.role.code,
        organizationId,
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
