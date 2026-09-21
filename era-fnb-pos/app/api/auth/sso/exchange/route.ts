import {
  authCookieName,
  consumeSsoSignatureOnce,
  enterSatelliteTenant,
  executeSatelliteSsoExchange,
  resolveVerifiedSsoFinanceRole,
  satelliteOrganizationId,
  satelliteRuntimeConfig,
  signSatelliteSession,
  ssoExchangeBodySchema,
} from "@era/satellite-kit";
import { jsonError, jsonOk, handleRouteError } from "@/lib/api-utils";
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

/**
 * SEC-SSO-02 + SEC-SSO-01.
 * SEC-SSO-05: DEDICATED/ONPREM require ticket org == process bind; SHARED accepts ticket org.
 */
export async function POST(request: Request) {
  try {
    const body = ssoExchangeBodySchema.parse(await request.json());
    if (body.expiresAt < Math.floor(Date.now() / 1000)) {
      return jsonError("SSO token expired", 401);
    }
    const financeRole = resolveVerifiedSsoFinanceRole({
      email: body.email,
      organizationId: body.organizationId,
      expiresAt: body.expiresAt,
      signature: body.signature,
      financeRole: body.financeRole,
      jti: body.jti,
    });
    if (!financeRole) {
      return jsonError("Invalid SSO signature", 401);
    }
    if (!consumeSsoSignatureOnce(body.signature, body.expiresAt)) {
      return jsonError("SSO ticket already used", 401);
    }

    const topology = satelliteRuntimeConfig().deploymentTopology;
    let deployOrg: string | null = null;
    try {
      deployOrg = satelliteOrganizationId();
    } catch {
      deployOrg = null;
    }
    if (
      topology !== "SHARED" &&
      deployOrg &&
      deployOrg !== "demo-org" &&
      body.organizationId !== deployOrg
    ) {
      return jsonError("SSO organization mismatch", 401);
    }

    enterSatelliteTenant({ organizationId: body.organizationId });

    const profile = await getFnbOrgProfile(body.organizationId);
    const edition = resolveFnbEdition(profile.edition, profile.hotelMode);
    await ensureSystemFnbRoles(prisma, body.organizationId, edition);

    const { token: _baseToken, user } = await executeSatelliteSsoExchange(
      { ...body, financeRole },
      prisma,
    );

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { role: true },
    });
    if (!dbUser) {
      return jsonError("SSO user missing", 500);
    }

    const isOwner = user.isOwner === true || user.role === "BUSINESS_OWNER";
    const bypass = hasFnbPermissionBypass({
      login: dbUser.login,
      email: body.email,
      role: user.role,
      isOwner,
    });
    const permissions = bypass
      ? [...ALL_PERMISSIONS]
      : effectiveRolePermissions(
          dbUser.role.code,
          dbUser.role.permissionsJson,
          edition,
        );

    const token = await signSatelliteSession({
      sub: user.id,
      login: user.login,
      email: body.email,
      role: user.role,
      roles: user.roles,
      fullName: user.fullName,
      organizationId: body.organizationId,
      isOwner,
      financeRole: user.financeRole,
      permissions,
    });

    const res = jsonOk({
      user: { ...user, permissions },
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
