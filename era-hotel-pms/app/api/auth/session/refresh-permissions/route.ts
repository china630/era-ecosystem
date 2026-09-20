import { jsonOk, handleRouteError, jsonError } from "@/lib/api-utils";
import { getSessionFromHeaders } from "@/lib/auth/session";
import { signToken } from "@/lib/auth/jwt";
import { permissionsForUser } from "@/lib/auth/hotel-permission.service";
import { hasHotelPermissionBypass } from "@/lib/auth/permission-check";
import { ALL_PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? "era_session";

/** Re-sign JWT from current Role.permissionsJson so page middleware matches DB. */
export async function POST() {
  try {
    const session = await getSessionFromHeaders();
    if (!session) return jsonError("Unauthorized", 401);

    const user = await prisma.user.findUnique({
      where: { id: session.sub },
      include: { role: true },
    });
    if (!user || user.status !== "ACTIVE") {
      return jsonError("Unauthorized", 401);
    }

    const isOwner =
      session.isOwner === true || user.role.code === "BUSINESS_OWNER";
    const bypass = hasHotelPermissionBypass({
      login: user.login,
      email: user.email ?? undefined,
      role: user.role.code,
      isOwner,
    });
    const permissions = bypass
      ? [...ALL_PERMISSIONS]
      : await permissionsForUser(session.sub);
    const token = await signToken({
      sub: session.sub,
      login: session.login || user.login,
      role: user.role.code,
      fullName: session.fullName || user.fullName,
      email: session.email ?? user.email ?? undefined,
      organizationId: session.organizationId ?? user.organizationId,
      permissions,
      isOwner,
    });

    const res = jsonOk({ ok: true, permissions });
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
