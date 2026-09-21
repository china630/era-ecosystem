import {
  authCookieName,
  signSatelliteSession,
} from "@era/satellite-kit";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { getSessionFromRequest } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  ensureSystemFnbRoles,
  resolveFnbEdition,
} from "@/lib/auth/ensure-system-fnb-roles";
import { getFnbOrgProfile } from "@/lib/fnb-org-profile";
import {
  ALL_PERMISSIONS,
  effectiveRolePermissions,
  isSystemFnbRoleCode,
} from "@/lib/auth/permissions";
import { hasFnbPermissionBypass } from "@/lib/auth/permission-check";
import { permissionsForRoleCode } from "@/lib/auth/fnb-permission.service";

/** Re-sign JWT from current Role.permissionsJson so page middleware matches DB. */
export async function POST(request: Request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session?.organizationId) return jsonError("Unauthorized", 401);

    const organizationId = session.organizationId;
    const profile = await getFnbOrgProfile(organizationId);
    const edition = resolveFnbEdition(profile.edition, profile.hotelMode);
    await ensureSystemFnbRoles(prisma, organizationId, edition);

    if (session.pin === true) {
      const code = isSystemFnbRoleCode(session.role)
        ? session.role
        : session.role;
      const permissions = await permissionsForRoleCode(organizationId, code);
      const token = await signSatelliteSession({
        sub: session.sub,
        login: session.login,
        role: code,
        fullName: session.fullName,
        organizationId,
        permissions,
        pin: true,
        outletId: session.outletId,
      });
      const res = jsonOk({ ok: true, permissions });
      res.cookies.set(authCookieName(), token, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 12,
      });
      return res;
    }

    const user = await prisma.user.findUnique({
      where: { id: session.sub },
      include: { role: true },
    });
    if (!user || user.status !== "ACTIVE") {
      return jsonError("Unauthorized", 401);
    }

    const isOwner =
      session.isOwner === true || user.role.code === "BUSINESS_OWNER";
    const bypass = hasFnbPermissionBypass({
      login: user.login,
      email: user.email ?? undefined,
      role: user.role.code,
      isOwner,
    });
    const permissions = bypass
      ? [...ALL_PERMISSIONS]
      : effectiveRolePermissions(
          user.role.code,
          user.role.permissionsJson,
          edition,
        );

    const token = await signSatelliteSession({
      sub: session.sub,
      login: session.login || user.login,
      email: session.email ?? user.email ?? undefined,
      role: user.role.code,
      fullName: session.fullName || user.fullName,
      organizationId: session.organizationId ?? user.organizationId,
      permissions,
      isOwner,
      financeRole: session.financeRole,
      roles: session.roles,
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
