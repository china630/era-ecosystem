import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { ensureSystemClinicRoles } from "@/lib/auth/ensure-system-clinic-roles";
import { parseClinicRoleStaffKind } from "@/lib/clinic-roles";
import { assignUserRole, findOrgRoleByCode, findOrgUserWithRole } from "@/domain/auth/clinic-rbac.service";
import { prisma } from "@/lib/prisma";
import { recordClinicAudit } from "@/lib/satellite-audit";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

type RouteParams = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  roleCode: z.string().trim().min(1).max(32),
});

/** Assign an existing org Role to a local user (ops RBAC). */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.patch("/api/admin/users/:id", async (httpReq, httpRes) => {
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

    const denied = await requireClinicPermission(
      gate.session,
      CLINIC_PERMISSION.ADMIN_ACCESS_MANAGE,
    );
    if (denied) return denied;

    const { id } = httpReq.params;
    const organizationId = gate.session.organizationId;
    await ensureSystemClinicRoles(prisma, organizationId);

    const body = patchSchema.parse(httpReq.body);
    const roleCode = body.roleCode.trim().toUpperCase();

    const user = await findOrgUserWithRole(organizationId, id);
    if (!user) return sendJson(httpRes, { error: "User not found" }, 404);

    const role = await findOrgRoleByCode(organizationId, roleCode);
    if (!role) {
      return sendJson(httpRes, { error: 
        "Role not found — create it on Access matrix first" }, 404);
    }

    if (user.roleId === role.id) {
      return sendJson(httpRes, {
        id: user.id,
        login: user.login,
        roleCode: role.code,
        staffKind: parseClinicRoleStaffKind(role.staffKind),
        unchanged: true,
      });
    }

    const updated = await assignUserRole(user.id, role.id);

    await recordClinicAudit(
      { userId: gate.session.sub, request: req },
      "User",
      user.id,
      "ROLE_ASSIGN",
      {
        login: user.login,
        beforeRole: user.role.code,
        afterRole: role.code,
      },
    );

    return sendJson(httpRes, {
      id: updated.id,
      login: updated.login,
      roleCode: updated.role.code,
      roleName: updated.role.name,
      staffKind: parseClinicRoleStaffKind(updated.role.staffKind),
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
