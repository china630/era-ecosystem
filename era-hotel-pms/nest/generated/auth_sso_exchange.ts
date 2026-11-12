import { consumeSsoSignatureOnce, resolveVerifiedSsoFinanceRole, ssoExchangeBodySchema, signSatelliteSession } from "@era/satellite-kit";
import { jsonOk } from "@/lib/api-utils";
import { remapPermissionList } from "@/lib/auth/hotel-permission-rename";
import { isPlatformSuperAdminUser } from "@/lib/auth/platform-super-admin";
import { recordUserLogin, userPermissions } from "@/lib/services/user.service";
import { provisionSsoFinanceUser } from "@/lib/services/hotel-auth.service";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? "era_session";

/**
 * SEC-SSO-02/01: Orchestrator mints HMAC (v2/v3); replay guard via consumeSsoSignatureOnce.
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
      request,
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

    const res = jsonOk({
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

    res.cookies.set(COOKIE_NAME, token, {
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
