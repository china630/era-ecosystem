import { authCookieName, consumeSsoSignatureOnce, enterSatelliteTenant, executeSatelliteSsoExchange, resolveVerifiedSsoFinanceRole, signSatelliteSession, ssoExchangeBodySchema } from "@era/satellite-kit";
import { jsonOk } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { ensureSystemRoles } from "@/lib/auth/ensure-system-crm-roles";
import { OWNER_ROLE_CODE } from "@/lib/auth/permission-check";
import { grantsForUser } from "@/lib/auth/crm-permission.service";
import { findUserWithRoleById } from "@/lib/users.service";
import { enterCrmStaff, crmNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithCrmTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

/**
 * SEC-SSO-02 + SEC-SSO-01: HMAC role bind + one-time signature consume.
 * System role packages are seeded before the kit binds the CP role.
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
    await ensureSystemRoles(prisma, body.organizationId);

    const { user } = await executeSatelliteSsoExchange({ ...body, financeRole }, prisma);

    const dbUser = await findUserWithRoleById(user.id);
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

    const res = jsonOk({ user: { ...user, permissions }, token });
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
