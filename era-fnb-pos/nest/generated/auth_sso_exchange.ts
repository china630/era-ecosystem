import { authCookieName, consumeSsoSignatureOnce, enterSatelliteTenant, resolveVerifiedSsoFinanceRole, signSatelliteSession, ssoExchangeBodySchema } from "@era/satellite-kit";
import { jsonOk } from "@/lib/api-utils";
import { ensureFnbSystemRoles, executeFnbSsoExchange, findUserWithRoleById } from "@/lib/fnb-auth.service";
import { resolveFnbEdition } from "@/lib/auth/ensure-system-fnb-roles";
import { getFnbOrgProfile } from "@/lib/fnb-org-profile";
import { ALL_PERMISSIONS, effectiveRolePermissions } from "@/lib/auth/permissions";
import { hasFnbPermissionBypass } from "@/lib/auth/permission-check";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

/**
 * SEC-SSO-02 + SEC-SSO-01.
 */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/auth/sso/exchange", async (httpReq, httpRes) => {
    try {
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
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

    const res = jsonOk({
      user: { ...user, permissions },
      token,
    });
    res.cookies.set(authCookieName(), token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
    return sendWebResponse(httpRes, res);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
