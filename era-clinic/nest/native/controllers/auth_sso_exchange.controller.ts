import { Controller, HttpCode, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import {
  sendJson,
  withClinicHttp,
} from "../../bridge";
import { expressKitHeaders, authCookieName, consumeSsoSignatureOnce, enterSatelliteTenant, executeSatelliteSsoExchange, resolveVerifiedSsoFinanceRole, signSatelliteSession, ssoExchangeBodySchema } from "@era/satellite-kit";
import { jsonOk } from "@/lib/api-utils";
import { permissionsForUser } from "@/lib/auth/clinic-permission.service";
import { prisma } from "@/lib/prisma";
import { findUserIdByLoginAndOrg, recordUserLogin } from "@/domain/auth/user-login.service";


/**
 * SEC-SSO-02 + SEC-SSO-01: HMAC role bind + one-time signature consume.
 */

@Controller()
export class AuthSsoExchangeController {

  @Post("api/auth/sso/exchange")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
    @Res({ passthrough: false }) httpRes: Response,
  ) {
    await withClinicHttp(httpReq, async () => {
      const body = ssoExchangeBodySchema.parse(httpReq.body);
    if (body.expiresAt < Math.floor(Date.now() / 1000)) {
      sendJson(httpRes, { error: "SSO token expired" }, 401); return;
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
      sendJson(httpRes, { error: "Invalid SSO signature" }, 401); return;
    }
    if (!consumeSsoSignatureOnce(body.signature, body.expiresAt)) {
      sendJson(httpRes, { error: "SSO ticket already used" }, 401); return;
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

    const dbUser = await findUserIdByLoginAndOrg(user.login, body.organizationId);
    const permissions = dbUser ? await permissionsForUser(dbUser.id) : [];
    if (dbUser) {
      await recordUserLogin({ id: dbUser.id, organizationId: body.organizationId, login: user.login }, expressKitHeaders(httpReq));
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
    httpRes.cookie(authCookieName(), token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8 * 1000,
    });
    sendJson(httpRes, res.body, res.status); return;
  
        });
  }
}
