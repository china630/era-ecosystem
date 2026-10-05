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
import { permissionsForUser } from "@/lib/auth/clinic-permission.service";
import { prisma } from "@/lib/prisma";
import { recordUserLogin } from "@/domain/auth/user-login.service";

/**
 * SEC-SSO-02 + SEC-SSO-01: HMAC role bind + one-time signature consume.
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

    const { ensureSystemClinicRoles } = await import(
      "@/lib/auth/ensure-system-clinic-roles"
    );
    await ensureSystemClinicRoles(prisma, body.organizationId);
    const { ensureClinicCatalogIfEmpty } = await import(
      "@/domain/catalog/ensure-clinic-catalog-from-templates"
    );
    await ensureClinicCatalogIfEmpty(prisma, body.organizationId);

    const { user } = await executeSatelliteSsoExchange(
      { ...body, financeRole },
      prisma,
    );

    const dbUser = await prisma.user.findFirst({
      where: { login: user.login, organizationId: body.organizationId },
      select: { id: true },
    });
    const permissions = dbUser ? await permissionsForUser(dbUser.id) : [];
    if (dbUser) {
      await recordUserLogin(
        { id: dbUser.id, organizationId: body.organizationId, login: user.login },
        request,
      );
    }
    const token = await signSatelliteSession({
      sub: user.id,
      login: user.login,
      email: body.email,
      role: user.role,
      fullName: user.fullName,
      organizationId: body.organizationId,
      roles: user.roles,
      isOwner: user.isOwner,
      financeRole: user.financeRole,
      permissions,
    });

    const res = jsonOk({ user, token });
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
