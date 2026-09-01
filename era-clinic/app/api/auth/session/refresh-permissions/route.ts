import {
  authCookieName,
  signSatelliteSession,
} from "@era/satellite-kit";
import {
  getRouteSession,
  handleRouteError,
  jsonError,
  jsonOk,
} from "@/lib/api-utils";
import { permissionsForUser } from "@/lib/auth/clinic-permission.service";

/** Re-sign JWT from current Role.permissionsJson so page middleware matches DB. */
export async function POST() {
  try {
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);

    const permissions = await permissionsForUser(session.sub);
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
      maxAge: 60 * 60 * 4,
    });
    return res;
  } catch (err) {
    return handleRouteError(err);
  }
}
