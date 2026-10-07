import {
  authCookieName,
  authenticateIndustryStaffLogin,
  jsonLoginHostBinding,
  satelliteRuntimeConfig,
  signSatelliteSession,
} from "@era/satellite-kit";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { ensureSystemRoles } from "@/lib/auth/ensure-system-retail-roles";
import { OWNER_ROLE_CODE } from "@/lib/auth/permission-check";
import { grantsForUser } from "@/lib/auth/retail-permission.service";

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
    const found = auth.user;
    const organizationId = auth.organizationId;
    await ensureSystemRoles(prisma, organizationId);

    const user = await prisma.user.findUnique({
      where: { id: found.id },
      include: { role: true },
    });
    if (!user) return jsonError("Invalid credentials", 401);
    const isOwner = user.role.code === OWNER_ROLE_CODE;
    const permissions = grantsForUser({
      login: user.login,
      email: user.email,
      role: user.role,
      isOwner,
    });

    const token = await signSatelliteSession({
      sub: user.id,
      login: user.login,
      email: user.email ?? undefined,
      role: user.role.code,
      fullName: user.fullName,
      organizationId,
      isOwner,
      permissions,
    });
    await prisma.userLogin
      .create({
        data: {
          organizationId,
          userId: user.id,
          login: user.login,
          ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
          userAgent: request.headers.get("user-agent"),
        },
      })
      .catch(() => undefined);

    const res = jsonOk({
      user: {
        id: user.id,
        login: user.login,
        fullName: user.fullName,
        role: user.role.code,
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
