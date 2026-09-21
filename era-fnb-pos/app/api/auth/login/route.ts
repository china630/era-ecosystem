import {
  ORG_NO_RE,
  authCookieName,
  enterSatelliteTenant,
  findUserByCredential,
  isSatelliteUserLoginAllowed,
  jsonLoginHostBinding,
  readStaffLoginJson,
  resolveStaffLoginTenant,
  satelliteRuntimeConfig,
  signSatelliteSession,
  verifySatelliteUserPassword,
} from "@era/satellite-kit";
import { z } from "zod";
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

const schema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
  /** SHARED pool: which F&B org. Appliance: omit → process bind only. */
  orgNo: z.string().regex(ORG_NO_RE).optional(),
});

export async function POST(request: Request) {
  try {
    const rawBody = await readStaffLoginJson(request);
    if (!rawBody.ok) {
      return jsonError(rawBody.error, rawBody.status);
    }
    const body = schema.parse(rawBody.raw);
    const tenant = await resolveStaffLoginTenant({
      orgNo: body.orgNo,
      isShared: satelliteRuntimeConfig().deploymentTopology === "SHARED",
      request,
    });
    if (!tenant.ok) {
      return jsonError(tenant.error, tenant.status);
    }
    const user = await findUserByCredential(prisma, body.login, tenant.organizationId);
    if (!(await verifySatelliteUserPassword(body.password, user)) || !user) {
      return jsonError("Invalid credentials", 401);
    }

    const organizationId = user.organizationId;
    enterSatelliteTenant({ organizationId });

    const profile = await getFnbOrgProfile(organizationId);
    const edition = resolveFnbEdition(profile.edition, profile.hotelMode);
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
