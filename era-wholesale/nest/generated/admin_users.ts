import { z } from "zod";
import { assertPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { hasPermissionBypass } from "@/lib/auth/permission-check";
import { normalizeRoleCode, roleAssignDenied } from "@/lib/auth/wholesale-role-admin";
import { recordAudit } from "@/lib/satellite-audit";
import { assignUserRole, findRoleByOrganizationAndCode, findUserForRoleAssign, listUsersForOrganization } from "@/lib/wholesale-admin-users.service";
import { enterWholesaleStaff, wholesaleNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithWholesaleTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const patchSchema = z.object({
  userId: z.string().trim().min(1),
  roleCode: z.string().trim().min(1).max(64),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/admin/users", async (httpReq, httpRes) => {
    if (!(await enterWholesaleStaff(httpReq, httpRes))) return;
    try {
      const session = await wholesaleNestSession(httpReq);
      const web = await runWithWholesaleTenant(session, async () => {
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

  
    assertPermission(session, PERMISSIONS.ACCESS_MANAGE);
    const users = await listUsersForOrganization(session.organizationId);
    return sendJson(httpRes, 
      users.map((u) => ({
        id: u.id,
        login: u.login,
        fullName: u.fullName,
        status: u.status,
        roleCode: u.role.code,
      })),
    );
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.patch("/api/admin/users", async (httpReq, httpRes) => {
    if (!(await enterWholesaleStaff(httpReq, httpRes))) return;
    try {
      const session = await wholesaleNestSession(httpReq);
      const web = await runWithWholesaleTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const req = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    assertPermission(session, PERMISSIONS.ACCESS_MANAGE);
    const organizationId = session.organizationId;
    const body = patchSchema.parse(httpReq.body);
    const roleCode = normalizeRoleCode(body.roleCode);

    const role = await findRoleByOrganizationAndCode(organizationId, roleCode);
    if (!role) return sendJson(httpRes, { error: "Unknown role code" }, 400);
    const user = await findUserForRoleAssign(body.userId, organizationId);
    if (!user) return sendJson(httpRes, { error: "User not found" }, 404);

    const denied = roleAssignDenied({
      actorBypass: hasPermissionBypass(session),
      fromRoleCode: user.role.code,
      toRoleCode: role.code,
    });
    if (denied) return sendJson(httpRes, { error: denied }, 403);

    await assignUserRole(user.id, role.id);
    await recordAudit({ userId: session.sub, request: req }, "User", user.id, "USER_ROLE_ASSIGN", {
      before: user.role.code,
      after: role.code,
    });

    return sendJson(httpRes, { userId: user.id, roleCode: role.code });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
