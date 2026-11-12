import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { CLINIC_PERMISSION, DEFAULT_ROLE_PERMISSIONS, effectiveRolePermissions, isClinicPermission, parseRolePermissions, rolePermissionsAreCustomized, serializeRolePermissions, type ClinicPermission } from "@/lib/auth/clinic-permissions";
import { isSystemClinicRoleCode } from "@/lib/clinic-roles";
import { findOrgRoleByCode, findOrgRoleForAdmin, updateOrgRolePermissions } from "@/domain/auth/clinic-rbac.service";
import { recordClinicAudit } from "@/lib/satellite-audit";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const patchSchema = z.object({
  permissions: z.array(z.string()).optional(),
  resetToDefaults: z.boolean().optional(),
});

type RouteParams = { params: Promise<{ code: string }> };

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/admin/roles/:code/permissions", async (httpReq, httpRes) => {
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

  
    const gate = await assertClinicAdminRoute(request);
    if (gate.error) return gate.error;

    const { code } = httpReq.params;
    const organizationId = gate.session.organizationId;
    const role = await findOrgRoleForAdmin(organizationId, code);
    if (!role) return sendJson(httpRes, { error: "Role not found" }, 404);

    const permissions = effectiveRolePermissions(role.code, role.permissionsJson);
    return sendJson(httpRes, {
      code: role.code,
      name: role.name,
      isSystem: role.isSystem,
      staffKind: role.staffKind,
      cloneFromCode: role.cloneFromCode,
      permissions,
      customized: rolePermissionsAreCustomized(role.code, role.permissionsJson),
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.patch("/api/admin/roles/:code/permissions", async (httpReq, httpRes) => {
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
    const role = await findOrgRoleForAdmin(organizationId, code);
    if (!role) return sendJson(httpRes, { error: "Role not found" }, 404);

    let next: ClinicPermission[];
    if (body.resetToDefaults) {
      if (isSystemClinicRoleCode(code) && DEFAULT_ROLE_PERMISSIONS[code]) {
        next = [...DEFAULT_ROLE_PERMISSIONS[code]];
      } else if (role.cloneFromCode) {
        const donor = await findOrgRoleByCode(organizationId, role.cloneFromCode);
        if (!donor) {
          return sendJson(httpRes, { error: "cloneFrom role missing; cannot reset" }, 400);
        }
        next = effectiveRolePermissions(donor.code, donor.permissionsJson);
      } else {
        return sendJson(httpRes, { error: "No defaults available for this role" }, 400);
      }
    } else if (body.permissions) {
      const invalid = body.permissions.filter((p) => !isClinicPermission(p));
      if (invalid.length > 0) {
        return sendJson(httpRes, { error: "Unknown permission codes", ...{ invalid } }, 400);
      }
      next = body.permissions as ClinicPermission[];
    } else {
      return sendJson(httpRes, { error: "permissions or resetToDefaults required" }, 400);
    }

    const before = parseRolePermissions(role.permissionsJson);
    const updated = await updateOrgRolePermissions(
      role.id,
      serializeRolePermissions(next),
    );

    await recordClinicAudit(
      { userId: gate.session.sub, request: req },
      "Role",
      role.id,
      "PERMISSIONS_UPDATE",
      {
        roleCode: code,
        before,
        after: next,
        resetToDefaults: body.resetToDefaults === true,
      },
    );

    return sendJson(httpRes, {
      code: updated.code,
      permissions: next,
      customized: true,
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
