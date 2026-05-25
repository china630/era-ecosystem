import {
  authCookieName,
  buildSsoPayload,
  mapFinanceRoleToSatellite,
  SATELLITE_ROLE,
  signSatelliteSession,
  ssoExchangeBodySchema,
  verifySsoSignature,
} from "@era/satellite-kit";
import { jsonError, jsonOk, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = ssoExchangeBodySchema.parse(await request.json());
    if (body.expiresAt < Math.floor(Date.now() / 1000)) {
      return jsonError("SSO token expired", 401);
    }
    const payload = buildSsoPayload(body.email, body.organizationId, body.expiresAt);
    if (!verifySsoSignature(payload, body.signature)) {
      return jsonError("Invalid SSO signature", 401);
    }

    const financeRole = body.financeRole ?? "USER";
    const satelliteRole = mapFinanceRoleToSatellite(financeRole);
    const roleCodes = [
      satelliteRole,
      ...(satelliteRole === SATELLITE_ROLE.BUSINESS_OWNER
        ? [SATELLITE_ROLE.SATELLITE_OPERATOR]
        : []),
    ];

    let role = await prisma.role.findUnique({ where: { code: satelliteRole } });
    if (!role) {
      role = await prisma.role.create({
        data: {
          code: satelliteRole,
          name: satelliteRole === SATELLITE_ROLE.BUSINESS_OWNER ? "Business Owner" : "Satellite Operator",
          permissionsJson: "[]",
        },
      });
    }

    const login = `sso_${body.email.split("@")[0]}`;
    let user = await prisma.user.findUnique({ where: { login }, include: { role: true } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          login,
          email: body.email,
          fullName: body.fullName,
          passwordHash: "sso:no-password",
          roleId: role.id,
          isCrossSystem: true,
        },
        include: { role: true },
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date(), fullName: body.fullName, roleId: role.id },
        include: { role: true },
      });
    }

    const token = await signSatelliteSession({
      sub: user.id,
      login: user.login,
      role: satelliteRole,
      roles: roleCodes,
      fullName: user.fullName,
      organizationId: body.organizationId,
      isOwner: satelliteRole === SATELLITE_ROLE.BUSINESS_OWNER,
      financeRole,
    });

    const res = jsonOk({
      user: {
        id: user.id,
        login: user.login,
        fullName: user.fullName,
        role: satelliteRole,
        roles: roleCodes,
        isOwner: satelliteRole === SATELLITE_ROLE.BUSINESS_OWNER,
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
