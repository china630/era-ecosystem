import {
  authCookieName,
  consumeSsoSignatureOnce,
  enterSatelliteTenant,
  executeSatelliteSsoExchange,
  resolveVerifiedSsoFinanceRole,
  signSatelliteSession,
  ssoExchangeBodySchema,
} from "@era/satellite-kit";
import { jsonError, jsonOk, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { ensureSystemRoles } from "@/lib/auth/ensure-system-retail-roles";
import { OWNER_ROLE_CODE } from "@/lib/auth/permission-check";
import { grantsForUser } from "@/lib/auth/retail-permission.service";

/**
 * SEC-SSO-02 + SEC-SSO-01: HMAC role bind + one-time signature consume.
 * System role packages are seeded before the kit binds the CP role.
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

    enterSatelliteTenant({ organizationId: body.organizationId });
    await ensureSystemRoles(prisma, body.organizationId);

    const { user } = await executeSatelliteSsoExchange({ ...body, financeRole }, prisma);

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { role: true },
    });
    if (!dbUser) return jsonError("SSO user missing", 500);

    const isOwner = user.isOwner === true || dbUser.role.code === OWNER_ROLE_CODE;
    const permissions = grantsForUser({
      login: dbUser.login,
      email: body.email,
      role: dbUser.role,
      isOwner,
    });
    const token = await signSatelliteSession({
      sub: user.id,
      login: user.login,
      email: body.email,
      role: dbUser.role.code,
      roles: user.roles,
      fullName: user.fullName,
      organizationId: body.organizationId,
      isOwner,
      financeRole: user.financeRole,
      permissions,
    });

    const res = jsonOk({ user: { ...user, permissions }, token });
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
