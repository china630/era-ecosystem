import { authCookieName, signSatelliteSession } from "@era/satellite-kit";
import { jsonOk } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { findOpsUserWithRole } from "@/lib/bank-ops.service";
import { ensureSystemBankRoles } from "@/lib/auth/ensure-system-bank-roles";
import { ALL_PERMISSIONS, effectiveRolePermissions } from "@/lib/auth/permissions";
import { hasBankPermissionBypass } from "@/lib/auth/permission-check";
import { enterBankStaff, bankNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithBankTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

/** Re-sign JWT from current OpsRole.permissionsJson so page middleware matches DB. */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/auth/session/refresh-permissions", async (httpReq, httpRes) => {
    if (!(await enterBankStaff(httpReq, httpRes))) return;
    try {
      const session = await bankNestSession(httpReq);
      const web = await runWithBankTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    if (!session?.organizationId) return sendJson(httpRes, { error: "Unauthorized" }, 401);

    const organizationId = session.organizationId;
    await ensureSystemBankRoles(prisma, organizationId);

    const user = await findOpsUserWithRole(session.sub);
    if (!user || user.status !== "ACTIVE") {
      return sendJson(httpRes, { error: "Unauthorized" }, 401);
    }

    const isOwner =
      session.isOwner === true || user.opsRole.code === "BUSINESS_OWNER";
    const bypass = hasBankPermissionBypass({
      login: user.username,
      email: session.email,
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
      sub: session.sub,
      login: session.login || user.username,
      email: session.email,
      role: user.opsRole.code,
      fullName: session.fullName || user.fullName,
      organizationId: session.organizationId ?? user.organizationId,
      permissions,
      isOwner,
      financeRole: session.financeRole,
      roles: session.roles,
    });

    const res = jsonOk({ ok: true, permissions });
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
