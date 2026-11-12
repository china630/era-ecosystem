import { z } from "zod";
import { publishSatelliteRole } from "@era/satellite-kit";
import { requireClinicPermission } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { canMutateCustomRoleMeta, canDeleteClinicRole, parseAssignableStaffKind } from "@/lib/auth/clinic-role-admin";
import { parseClinicRoleStaffKind, type ClinicRoleStaffKind } from "@/lib/clinic-roles";
import { deleteOrgRole, findOrgRoleForAdmin, findOrgRoleWithUserCount, updateOrgRoleMeta } from "@/domain/auth/clinic-rbac.service";
import { recordClinicAudit } from "@/lib/satellite-audit";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

type RouteParams = { params: Promise<{ code: string }> };

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  staffKind: z.enum(["DOCTOR", "NURSE", "LAB", "BATH", "MASSAGE", "NONE"]).optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.patch("/api/admin/roles/:code", async (httpReq, httpRes) => {
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

    const { code } = httpReq.params;
    const organizationId = gate.session.organizationId;
    const body = patchSchema.parse(httpReq.body);
    if (body.name === undefined && body.staffKind === undefined) {
      return sendJson(httpRes, { error: "name or staffKind required" }, 400);
    }

    const role = await findOrgRoleForAdmin(organizationId, code);
    if (!role) return sendJson(httpRes, { error: "Role not found" }, 404);

    if (body.staffKind !== undefined && !canMutateCustomRoleMeta(role)) {
      return sendJson(httpRes, { error: "Cannot change staffKind on a system role" }, 400);
    }
    if (body.name !== undefined && !canMutateCustomRoleMeta(role)) {
      return sendJson(httpRes, { error: "Cannot rename a system role" }, 400);
    }

    const before = {
      name: role.name,
      staffKind: parseClinicRoleStaffKind(role.staffKind),
    };
    const data: { name?: string; staffKind?: ClinicRoleStaffKind } = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.staffKind !== undefined) {
      const kind = parseAssignableStaffKind(body.staffKind);
      if (!kind) return sendJson(httpRes, { error: "Invalid staffKind" }, 400);
      data.staffKind = kind;
    }

    const updated = await updateOrgRoleMeta(role.id, data);

    await recordClinicAudit(
      { userId: gate.session.sub, request: req },
      "Role",
      role.id,
      "ROLE_UPDATE",
      {
        code: role.code,
        before,
        after: {
          name: updated.name,
          staffKind: parseClinicRoleStaffKind(updated.staffKind),
        },
      },
    );

    void publishSatelliteRole({
      organizationId,
      satelliteKey: "industry_clinic",
      code: updated.code,
      name: updated.name,
      active: true,
    });

    return sendJson(httpRes, {
      code: updated.code,
      name: updated.name,
      isSystem: updated.isSystem,
      staffKind: parseClinicRoleStaffKind(updated.staffKind),
      cloneFromCode: updated.cloneFromCode,
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.delete("/api/admin/roles/:code", async (httpReq, httpRes) => {
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

    const { code } = httpReq.params;
    const organizationId = gate.session.organizationId;
    const role = await findOrgRoleWithUserCount(organizationId, code);
    if (!role) return sendJson(httpRes, { error: "Role not found" }, 404);
    const deletable = canDeleteClinicRole({
      isSystem: role.isSystem,
      code: role.code,
      userCount: role._count.users,
    });
    if (!deletable.ok) {
      if (deletable.reason === "system") {
        return sendJson(httpRes, { error: "Cannot delete a system role" }, 400);
      }
      return sendJson(httpRes, { error: "Role still has users", ...{
        userCount: role._count.users,
      } }, 409);
    }

    await deleteOrgRole(role.id);
    await recordClinicAudit(
      { userId: gate.session.sub, request: req },
      "Role",
      role.id,
      "ROLE_DELETE",
      { code: role.code, name: role.name },
    );

    void publishSatelliteRole({
      organizationId,
      satelliteKey: "industry_clinic",
      code: role.code,
      name: role.name,
      active: false,
    });

    return sendJson(httpRes, { deleted: true, code: role.code });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
