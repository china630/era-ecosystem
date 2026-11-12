import { authCookieName, consumeSsoSignatureOnce, enterSatelliteTenant, mapFinanceRoleToSatellite, resolveVerifiedSsoFinanceRole, SATELLITE_ROLE, signSatelliteSession, ssoExchangeBodySchema } from "@era/satellite-kit";
import { jsonOk } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { provisionSsoOpsUser } from "@/lib/bank-ops.service";
import { ensureSystemBankRoles, BANK_PERMISSION_CATALOG_VERSION } from "@/lib/auth/ensure-system-bank-roles";
import { ALL_PERMISSIONS, effectiveRolePermissions, permissionsForRole, serializePermissions, SYSTEM_ROLE_NAMES, type RoleCode } from "@/lib/auth/permissions";
import { hasBankPermissionBypass } from "@/lib/auth/permission-check";
import { enterBankStaff, bankNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithBankTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const DEMO_BRANCH_ID = "demo-branch-hq";

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
    await ensureSystemBankRoles(prisma, body.organizationId);

    const satelliteRole = mapFinanceRoleToSatellite(financeRole) as RoleCode;
    const roleName =
      SYSTEM_ROLE_NAMES[satelliteRole] ??
      (satelliteRole === SATELLITE_ROLE.BUSINESS_OWNER
        ? "Business Owner"
        : "Executive viewer");

    const username = `sso_${body.email.split("@")[0]}`;
    const isOwner = satelliteRole === SATELLITE_ROLE.BUSINESS_OWNER;
    const user = await provisionSsoOpsUser({
      organizationId: body.organizationId,
      satelliteRole,
      roleName,
      permissionsJson: serializePermissions(permissionsForRole(satelliteRole)),
      permissionCatalogVersion: BANK_PERMISSION_CATALOG_VERSION,
      username,
      fullName: body.fullName,
      branchId: DEMO_BRANCH_ID,
    });

    const bypass = hasBankPermissionBypass({
      login: user.username,
      email: body.email,
      role: user.opsRole.code,
      isOwner,
    });
    const permissions = bypass
      ? [...ALL_PERMISSIONS]
      : effectiveRolePermissions(
          user.opsRole.code,
          user.opsRole.permissionsJson,
        );

    const token = await signSatelliteSession({
      sub: user.id,
      login: user.username,
      email: body.email,
      role: user.opsRole.code,
      fullName: user.fullName,
      isOwner,
      organizationId: body.organizationId,
      permissions,
      financeRole,
    });

    const res = jsonOk({
      user: {
        id: user.id,
        login: user.username,
        fullName: user.fullName,
        role: user.opsRole.code,
        organizationId: body.organizationId,
        permissions,
      },
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
