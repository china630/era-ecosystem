import { authCookieName, signSatelliteSession } from "@era/satellite-kit";
import { jsonOk } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { ensureSystemRoles } from "@/lib/auth/ensure-system-logistics-roles";
import { OWNER_ROLE_CODE } from "@/lib/auth/permission-check";
import { enterLogisticsStaff, logisticsNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithLogisticsTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

/** Re-sign the JWT from the current role row so page middleware matches the DB. */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/auth/session/refresh-permissions", async (httpReq, httpRes) => {
    if (!(await enterLogisticsStaff(httpReq, httpRes))) return;
    try {
      const session = await logisticsNestSession(httpReq);
      const web = await runWithLogisticsTenant(session, async () => {
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

  
    const fresh = session;
    if (!fresh) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    await ensureSystemRoles(prisma, fresh.organizationId);

    const token = await signSatelliteSession({
      sub: fresh.sub,
      login: fresh.login,
      email: fresh.email,
      role: fresh.role,
      roles: fresh.roles,
      fullName: fresh.fullName,
      organizationId: fresh.organizationId,
      isOwner: fresh.isOwner === true || fresh.role === OWNER_ROLE_CODE,
      financeRole: fresh.financeRole,
      permissions: fresh.permissions,
    });
    const res = jsonOk({ ok: true, permissions: fresh.permissions });
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
