import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { ensureSystemClinicRoles } from "@/lib/auth/ensure-system-clinic-roles";
import { parseClinicRoleStaffKind } from "@/lib/clinic-roles";
import { listOrgStaffUsers } from "@/domain/auth/clinic-rbac.service";
import { prisma } from "@/lib/prisma";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

/** List local staff users for role assignment on /admin/access. */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/admin/users", async (httpReq, httpRes) => {
    try {
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const req = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    const gate = await assertClinicAdminRoute(req);
    if (gate.error) return gate.error;

    const organizationId = gate.session.organizationId;
    await ensureSystemClinicRoles(prisma, organizationId);

    const users = await listOrgStaffUsers(organizationId);

    return sendJson(httpRes, 
      users.map((u) => ({
        id: u.id,
        login: u.login,
        fullName: u.fullName,
        email: u.email,
        status: u.status,
        isCrossSystem: u.isCrossSystem,
        roleCode: u.role.code,
        roleName: u.role.name,
        roleIsSystem: u.role.isSystem,
        staffKind: parseClinicRoleStaffKind(u.role.staffKind),
      })),
    );
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
