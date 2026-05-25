import {
  authCookieName,
  buildSsoPayload,
  signSatelliteSession,
  ssoExchangeBodySchema,
  verifySsoSignature,
} from "@era/satellite-kit";
import { jsonError, jsonOk, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const ROLE_CODE = "SATELLITE_OPERATOR";

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

    let role = await prisma.role.findUnique({ where: { code: ROLE_CODE } });
    if (!role) {
      role = await prisma.role.create({
        data: { code: ROLE_CODE, name: "Satellite Operator", permissionsJson: "[]" },
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
        data: { lastLoginAt: new Date(), fullName: body.fullName },
        include: { role: true },
      });
    }

    const token = await signSatelliteSession({
      sub: user.id,
      login: user.login,
      role: user.role.code,
      fullName: user.fullName,
    });

    const res = jsonOk({
      user: { id: user.id, login: user.login, fullName: user.fullName, role: user.role.code },
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
