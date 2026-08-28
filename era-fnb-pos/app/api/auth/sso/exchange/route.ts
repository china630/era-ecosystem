import {
  authCookieName,
  consumeSsoSignatureOnce,
  enterSatelliteTenant,
  executeSatelliteSsoExchange,
  resolveVerifiedSsoFinanceRole,
  satelliteOrganizationId,
  satelliteRuntimeConfig,
  ssoExchangeBodySchema,
} from "@era/satellite-kit";
import { jsonError, jsonOk, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

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
