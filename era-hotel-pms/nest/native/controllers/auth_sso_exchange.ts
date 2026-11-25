/** Lifted from era-hotel-pms/nest/generated/auth_sso_exchange.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { consumeSsoSignatureOnce, resolveVerifiedSsoFinanceRole, ssoExchangeBodySchema, signSatelliteSession } from "@era/satellite-kit";
import { remapPermissionList } from "@/lib/auth/hotel-permission-rename";
import { isPlatformSuperAdminUser } from "@/lib/auth/platform-super-admin";
import { recordUserLogin, userPermissions } from "@/lib/services/user.service";
import { provisionSsoFinanceUser } from "@/lib/services/hotel-auth.service";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, cookieSeconds, sendRouteError } from "../../bridge";

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? "era_session";

/**
 * SEC-SSO-02/01: Orchestrator mints HMAC (v2/v3); replay guard via consumeSsoSignatureOnce.
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

    const organizationId = body.organizationId;
    const isOwner =
      financeRole === "BUSINESS_OWNER" || body.financeRole === "BUSINESS_OWNER";

    const provisioned = await provisionSsoFinanceUser({
      organizationId,
      email: body.email,
      fullName: body.fullName,
      financeRole,
    });
    if (!provisioned.ok) {
      return sendJson(httpRes, { error: "System role missing after ensure" }, 500);
    }

    const { user, isPlatformSuperAdmin, email } = provisioned;
    if (!user) {
      return sendJson(httpRes, { error: "SSO user provisioning failed" }, 500);
    }

    await recordUserLogin(
      { id: user.id, organizationId, login: user.login },
      { headers: { get: (name: string) => nestHeader(httpReq, name) } },
    );

    const permissions = userPermissions(user);
    const token = await signSatelliteSession({
      sub: user.id,
      login: user.login,
      role: user.role.code,
      fullName: user.fullName,
      email,
      organizationId,
      permissions: permissions.length ? remapPermissionList(permissions) : undefined,
      isOwner: isOwner || undefined,
    });

    cookieSeconds(httpRes, COOKIE_NAME, token, 60 * 60 * 8);
    return sendJson(httpRes, {
      user: {
        id: user.id,
        login: user.login,
        fullName: user.fullName,
        role: user.role.code,
        organizationId,
        isPlatformSuperAdmin,
        financeRole,
        permissions,
      },
      token,
    });
  
        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
