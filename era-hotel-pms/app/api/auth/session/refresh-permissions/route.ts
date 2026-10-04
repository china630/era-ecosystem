import { jsonOk, handleRouteError, jsonError } from "@/lib/api-utils";
import { getSatelliteSession } from "@/lib/auth/session";
import { signSatelliteSession } from "@era/satellite-kit";
import { remapPermissionList } from "@/lib/auth/hotel-permission-rename";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? "era_session";

/** Re-sign JWT from current Role.permissionsJson so page middleware matches DB. */
export async function POST() {
  try {
    const session = await getSatelliteSession();
    if (!session) return jsonError("Unauthorized", 401);

    const user = await prisma.user.findUnique({
      where: { id: session.sub },
      include: { role: true },
    });
    if (!user) return jsonError("Unauthorized", 401);

    const isOwner =
      session.isOwner === true || user.role.code === "BUSINESS_OWNER";
    const permissions = session.permissions ?? [];
    const token = await signSatelliteSession({
      sub: session.sub,
      login: session.login || user.login,
      role: user.role.code,
      fullName: session.fullName || user.fullName,
      email: session.email ?? user.email ?? undefined,
      organizationId: session.organizationId,
      permissions: permissions.length ? remapPermissionList(permissions) : undefined,
      isOwner: isOwner || undefined,
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
