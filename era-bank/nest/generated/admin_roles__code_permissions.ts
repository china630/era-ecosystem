import { z } from "zod";
import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/auth/require";
import { PERMISSIONS, effectiveRolePermissions, isBankPermission, isSystemBankRoleCode, parsePermissions, serializePermissions, type Permission } from "@/lib/auth/permissions";
import { BANK_PERMISSION_CATALOG_VERSION, templatePermissionsForReset } from "@/lib/auth/ensure-system-bank-roles";
import { findOpsRoleByCode, updateOpsRolePermissions } from "@/lib/bank-ops.service";
import { enterBankStaff, bankNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithBankTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const patchSchema = z.object({
  permissions: z.array(z.string()).optional(),
  resetToDefaults: z.boolean().optional(),
});

type RouteParams = { params: Promise<{ code: string }> };

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/admin/roles/:code/permissions", async (httpReq, httpRes) => {
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

  
    if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    assertPermission(session, PERMISSIONS.ACCESS_MANAGE);

    const { code } = httpReq.params;
    const organizationId = session.organizationId;
    if (!organizationId) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const role = await findOpsRoleByCode(organizationId, code);
    if (!role) return sendJson(httpRes, { error: "Role not found" }, 404);

    const permissions = effectiveRolePermissions(
      role.code,
      role.permissionsJson,
    );
    return sendJson(httpRes, {
      code: role.code,
      name: role.name,
      isSystem: role.isSystem,
      cloneFromCode: role.cloneFromCode,
      permissions,
      customized: parsePermissions(role.permissionsJson).length > 0,
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.patch("/api/admin/roles/:code/permissions", async (httpReq, httpRes) => {
    if (!(await enterBankStaff(httpReq, httpRes))) return;
    try {
      const session = await bankNestSession(httpReq);
      const web = await runWithBankTenant(session, async () => {
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

  
    if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    assertPermission(session, PERMISSIONS.ACCESS_MANAGE);

    const { code } = httpReq.params;
    const organizationId = session.organizationId;
    if (!organizationId) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const body = patchSchema.parse(httpReq.body);
    const role = await findOpsRoleByCode(organizationId, code);
    if (!role) return sendJson(httpRes, { error: "Role not found" }, 404);

    let next: Permission[];
    if (body.resetToDefaults) {
      next = templatePermissionsForReset(role);
      if (next.length === 0 && !isSystemBankRoleCode(code)) {
        return sendJson(httpRes, { error: "No defaults available for this role" }, 400);
      }
    } else if (body.permissions) {
      const invalid = body.permissions.filter((p) => !isBankPermission(p));
      if (invalid.length > 0) {
        return sendJson(httpRes, 
          { error: "Unknown permission codes", invalid }, 400);
      }
      next = body.permissions as Permission[];
    } else {
      return sendJson(httpRes, { error: "permissions or resetToDefaults required" }, 400);
    }

    const updated = await updateOpsRolePermissions(
      role.id,
      serializePermissions(next),
      BANK_PERMISSION_CATALOG_VERSION,
    );

    return sendJson(httpRes, {
      code: updated.code,
      permissions: parsePermissions(updated.permissionsJson),
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
