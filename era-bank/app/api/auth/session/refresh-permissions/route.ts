import {
  authCookieName,
  signSatelliteSession,
} from "@era/satellite-kit";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { getRouteSession } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { ensureSystemBankRoles } from "@/lib/auth/ensure-system-bank-roles";
import {
  ALL_PERMISSIONS,
  effectiveRolePermissions,
} from "@/lib/auth/permissions";
import { hasBankPermissionBypass } from "@/lib/auth/permission-check";

/** Re-sign JWT from current OpsRole.permissionsJson so page middleware matches DB. */
export async function POST() {
  try {
    const session = await getRouteSession();
    if (!session?.organizationId) return jsonError("Unauthorized", 401);

    const organizationId = session.organizationId;
    await ensureSystemBankRoles(prisma, organizationId);

    const user = await prisma.opsUser.findUnique({
      where: { id: session.sub },
      include: { opsRole: true },
    });
    if (!user || user.status !== "ACTIVE") {
      return jsonError("Unauthorized", 401);
    }

    const isOwner =
      session.isOwner === true || user.opsRole.code === "BUSINESS_OWNER";
    const bypass = hasBankPermissionBypass({
      login: user.username,
      email: session.email,
      role: user.opsRole.code,
      isOwner,
    });
    const permissions = bypass
      ? [...ALL_PERMISSIONS]
      : effectiveRolePermissions(
          user.opsRole.code,
          user.opsRole.permissionsJson,
        );

    const token = await signSatelliteSession({
      sub: session.sub,
      login: session.login || user.username,
      email: session.email,
      role: user.opsRole.code,
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
      maxAge: 60 * 60 * 4,
    });
    return res;
  } catch (err) {
    return handleRouteError(err);
  }
}
