import { isPlatformSuperAdminEdge } from "@/lib/auth/platform-super-admin-edge";
import { OWNER_ROLE_CODE } from "@/lib/auth/permission-check";
import { findUserProfileById } from "@/lib/logistics-auth.service";
import { enterLogisticsStaff, logisticsNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithLogisticsTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

/** Signed-in person and current DB grants for the ops shell and client doors. */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/auth/me", async (httpReq, httpRes) => {
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

  
    if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);

    const user = await findUserProfileById(session.sub);
    if (!user) return sendJson(httpRes, { error: "User not found" }, 404);

    return sendJson(httpRes, {
      id: user.id,
      login: user.login,
      email: user.email,
      fullName: user.fullName,
      role: session.role,
      organizationId: session.organizationId,
      organizationName: null,
      permissions: session.permissions,
      isOwner: session.isOwner === true || session.role === OWNER_ROLE_CODE,
      isPlatformSuperAdmin: isPlatformSuperAdminEdge(user),
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
