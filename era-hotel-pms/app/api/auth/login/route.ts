import {
  authenticateIndustryStaffLogin,
  jsonLoginHostBinding,
  satelliteRuntimeConfig,
  signSatelliteSession,
} from "@era/satellite-kit";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { remapPermissionList } from "@/lib/auth/hotel-permission-rename";
import { recordUserLogin, userPermissions } from "@/lib/services/user.service";
import { prisma } from "@/lib/prisma";
import { ensureSystemHotelRoles } from "@/lib/auth/ensure-system-hotel-roles";

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? "era_session";

export async function POST(request: Request) {
  try {
    const auth = await authenticateIndustryStaffLogin({
      request,
      prisma,
      isShared: satelliteRuntimeConfig().deploymentTopology === "SHARED",
    });
    if (!auth.ok) {
      return Response.json({ error: auth.error }, { status: auth.status });
    }
    const user = auth.user;
    const organizationId = auth.organizationId;

    await ensureSystemHotelRoles(prisma, organizationId);

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    await recordUserLogin(
      { id: user.id, organizationId, login: user.login },
      request,
    );

    // Reload role after ensure (permissions may have been filled).
    const refreshed = await prisma.user.findUnique({
      where: { id: user.id },
      include: { role: true },
    });
    if (!refreshed || refreshed.status !== "ACTIVE") {
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const permissions = userPermissions(refreshed);
    const token = await signSatelliteSession({
      sub: refreshed.id,
      login: refreshed.login,
      role: refreshed.role.code,
      fullName: refreshed.fullName,
      email: refreshed.email ?? undefined,
      organizationId,
      permissions: permissions.length ? remapPermissionList(permissions) : undefined,
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

    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });

    return res;
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function GET(request: Request) {
  return jsonLoginHostBinding(request);
}
