/** Lifted from nest/generated/auth_sso_exchange.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { authCookieName, consumeSsoSignatureOnce, enterSatelliteTenant, resolveVerifiedSsoFinanceRole, signSatelliteSession, ssoExchangeBodySchema } from "@era/satellite-kit";
import { ensureFnbSystemRoles, executeFnbSsoExchange, findUserWithRoleById } from "@/lib/fnb-auth.service";
import { resolveFnbEdition } from "@/lib/auth/ensure-system-fnb-roles";
import { getFnbOrgProfile } from "@/lib/fnb-org-profile";
import { ALL_PERMISSIONS, effectiveRolePermissions } from "@/lib/auth/permissions";
import { hasFnbPermissionBypass } from "@/lib/auth/permission-check";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, cookieSeconds, sendRouteError } from "../../bridge";

/**
 * SEC-SSO-02 + SEC-SSO-01.
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

    const profile = await getFnbOrgProfile(body.organizationId);
    const edition = resolveFnbEdition(profile.edition);
    await ensureFnbSystemRoles(body.organizationId, edition);

    const { token: _baseToken, user } = await executeFnbSsoExchange(
      { ...body, financeRole },
    );

    const dbUser = await findUserWithRoleById(user.id);
    if (!dbUser) {
      return sendJson(httpRes, { error: "SSO user missing" }, 500);
    }

    const isOwner = user.isOwner === true || user.role === "BUSINESS_OWNER";
    const bypass = hasFnbPermissionBypass({
      login: dbUser.login,
      email: body.email,
      role: user.role,
      isOwner,
    });
    const permissions = bypass
      ? [...ALL_PERMISSIONS]
      : effectiveRolePermissions(
          dbUser.role.code,
          dbUser.role.permissionsJson,
          edition,
        );

    const token = await signSatelliteSession({
      sub: user.id,
      login: user.login,
      email: body.email,
      role: user.role,
      roles: user.roles,
      fullName: user.fullName,
      organizationId: body.organizationId,
      isOwner,
      financeRole: user.financeRole,
      permissions,
    });

    cookieSeconds(httpRes, authCookieName(), token, 60 * 60 * 8);
    return sendJson(httpRes, {
      user: { ...user, permissions },
      token,
    });
  
        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
