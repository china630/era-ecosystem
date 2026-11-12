import { authCookieName, consumeSsoSignatureOnce, enterSatelliteTenant, executeSatelliteSsoExchange, resolveVerifiedSsoFinanceRole, signSatelliteSession, ssoExchangeBodySchema } from "@era/satellite-kit";
import { jsonOk } from "@/lib/api-utils";
import { permissionsForUser } from "@/lib/auth/clinic-permission.service";
import { prisma } from "@/lib/prisma";
import { findUserIdByLoginAndOrg, recordUserLogin } from "@/domain/auth/user-login.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

/**
 * SEC-SSO-02 + SEC-SSO-01: HMAC role bind + one-time signature consume.
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
