import { z } from "zod";
import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/auth/require";
import { PERMISSIONS, PERMISSION_CATALOG_VERSION, type Permission } from "@/lib/auth/permissions";
import { effectiveRolePermissions, isPermission, isSystemRoleCode, parsePermissions, serializePermissions } from "@/lib/auth/permission-catalog";
import { templatePermissionsForReset } from "@/lib/auth/ensure-system-wholesale-roles";
import { recordAudit } from "@/lib/satellite-audit";
import { findRoleByOrganizationAndCode, updateRolePermissions } from "@/lib/wholesale-admin-roles.service";
import { enterWholesaleStaff, wholesaleNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithWholesaleTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const patchSchema = z.object({
  permissions: z.array(z.string()).optional(),
  resetToDefaults: z.boolean().optional(),
});

type RouteParams = { params: Promise<{ code: string }> };

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/admin/roles/:code/permissions", async (httpReq, httpRes) => {
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
    const { code } = httpReq.params;
    const role = await findRoleByOrganizationAndCode(session.organizationId, code);
    if (!role) return sendJson(httpRes, { error: "Role not found" }, 404);

    return sendJson(httpRes, {
      code: role.code,
      name: role.name,
      isSystem: role.isSystem,
      cloneFromCode: role.cloneFromCode,
      permissions: effectiveRolePermissions(role),
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.patch("/api/admin/roles/:code/permissions", async (httpReq, httpRes) => {
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
    const { code } = httpReq.params;
    const body = patchSchema.parse(httpReq.body);
    const role = await findRoleByOrganizationAndCode(session.organizationId, code);
    if (!role) return sendJson(httpRes, { error: "Role not found" }, 404);

    let next: Permission[];
    if (body.resetToDefaults) {
      next = templatePermissionsForReset(role);
      if (next.length === 0 && !isSystemRoleCode(role.code)) {
        return sendJson(httpRes, { error: "No defaults available for this role" }, 400);
      }
    } else if (body.permissions) {
      const invalid = body.permissions.filter((p) => !isPermission(p));
      if (invalid.length > 0) {
        return sendJson(httpRes, { error: "Unknown permission codes", invalid }, 400);
      }
      next = body.permissions as Permission[];
    } else {
      return sendJson(httpRes, { error: "permissions or resetToDefaults required" }, 400);
    }

    const before = effectiveRolePermissions(role);
    const updated = await updateRolePermissions(
      role.id,
      serializePermissions(next),
      PERMISSION_CATALOG_VERSION,
    );
    await recordAudit(
      { userId: session.sub, request: req },
      "Role",
      role.id,
      "ROLE_PERMISSIONS_PATCH",
      { code: role.code, before, after: next, resetToDefaults: body.resetToDefaults === true },
    );

    return sendJson(httpRes, { code: updated.code, permissions: parsePermissions(updated.permissionsJson) });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
