import {
  authCookieName,
  buildSsoPayload,
  executeSatelliteSsoExchange,
  ssoExchangeBodySchema,
  verifySsoSignature,
} from "@era/satellite-kit";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
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

    const { token, user } = await executeSatelliteSsoExchange(body, prisma);

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
