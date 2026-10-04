import {
  authCookieName,
  signSatelliteSession,
} from "@era/satellite-kit";
import {
  getSatelliteSession,
  handleRouteError,
  jsonError,
  jsonOk,
} from "@/lib/api-utils";

/** Re-sign JWT from current Role.permissionsJson so page middleware matches DB. */
export async function POST() {
  try {
    const session = await getSatelliteSession();
    if (!session) return jsonError("Unauthorized", 401);

    const permissions = session.permissions ?? [];
    const token = await signSatelliteSession({
      sub: session.sub,
      login: session.login,
      email: session.email,
      role: session.role,
      fullName: session.fullName,
      organizationId: session.organizationId,
      roles: session.roles,
      isOwner: session.isOwner,
      financeRole: session.financeRole,
      permissions,
    });

    const res = jsonOk({ ok: true, permissions });
    res.cookies.set(authCookieName(), token, {
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
