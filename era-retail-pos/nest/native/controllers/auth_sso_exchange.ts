/** Lifted from nest/generated/auth_sso_exchange.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { authCookieName, consumeSsoSignatureOnce, enterSatelliteTenant, executeSatelliteSsoExchange, resolveVerifiedSsoFinanceRole, signSatelliteSession, ssoExchangeBodySchema } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";
import { ensureSystemRoles } from "@/lib/auth/ensure-system-retail-roles";
import { OWNER_ROLE_CODE } from "@/lib/auth/permission-check";
import { grantsForUser } from "@/lib/auth/retail-permission.service";
import { getUserWithRoleById } from "@/lib/retail-auth.service";
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, cookieSeconds, sendRouteError } from "../../bridge";

/**
 * SEC-SSO-02 + SEC-SSO-01: HMAC role bind + one-time signature consume.
 * System role packages are seeded before the kit binds the CP role.
 */


@Controller()
export class AuthSsoExchangeController {
  @Post("api/auth/sso/exchange")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  
    const body = ssoExchangeBodySchema.parse(httpReq.body);
    if (body.expiresAt < Math.floor(Date.now() / 1000)) {
      return sendJson(httpRes, { error: "SSO token expired" }, 401);
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
      return sendJson(httpRes, { error: "Invalid SSO signature" }, 401);
    }
    if (!consumeSsoSignatureOnce(body.signature, body.expiresAt)) {
      return sendJson(httpRes, { error: "SSO ticket already used" }, 401);
    }

    enterSatelliteTenant({ organizationId: body.organizationId });
    await ensureSystemRoles(prisma, body.organizationId);

    const { user } = await executeSatelliteSsoExchange({ ...body, financeRole }, prisma);

    const dbUser = await getUserWithRoleById(user.id);
    if (!dbUser) return sendJson(httpRes, { error: "SSO user missing" }, 500);

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

    cookieSeconds(httpRes, authCookieName(), token, 60 * 60 * 8);
    return sendJson(httpRes, { user: { ...user, permissions }, token });
  
        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
