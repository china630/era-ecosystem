import {
  authCookieName,
  executeSatelliteSsoExchange,
  resolveVerifiedSsoFinanceRole,
  ssoExchangeBodySchema,
} from "@era/satellite-kit";
import { jsonError, jsonOk, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

/** SEC-SSO-02: financeRole must be covered by HMAC (v2) or forced to USER (legacy v1). */
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
    });
    if (!financeRole) {
      return jsonError("Invalid SSO signature", 401);
    }

    const deployOrg = process.env.ERA_SATELLITE_ORGANIZATION_ID?.trim();
    // SEC-SSO-05: bind ticket org to deployment org when configured
    if (deployOrg && body.organizationId !== deployOrg) {
      return jsonError("SSO organization mismatch", 401);
    }

    const { token, user } = await executeSatelliteSsoExchange(
      { ...body, financeRole },
      prisma,
    );

    const res = jsonOk({ user, token });
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
