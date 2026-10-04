import { authCookieName, signSatelliteSession } from "@era/satellite-kit";
import { handleRouteError, jsonError, jsonOk, getSatelliteSession } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { ensureSystemRoles } from "@/lib/auth/ensure-system-wholesale-roles";
import { OWNER_ROLE_CODE } from "@/lib/auth/permission-check";

/** Re-sign the JWT from the current role row so page middleware matches the DB. */
export async function POST() {
  try {
    const fresh = await getSatelliteSession();
    if (!fresh) return jsonError("Unauthorized", 401);
    await ensureSystemRoles(prisma, fresh.organizationId);

    const token = await signSatelliteSession({
      sub: fresh.sub,
      login: fresh.login,
      email: fresh.email,
      role: fresh.role,
      roles: fresh.roles,
      fullName: fresh.fullName,
      organizationId: fresh.organizationId,
      isOwner: fresh.isOwner === true || fresh.role === OWNER_ROLE_CODE,
      financeRole: fresh.financeRole,
      permissions: fresh.permissions,
    });
    const res = jsonOk({ ok: true, permissions: fresh.permissions });
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
