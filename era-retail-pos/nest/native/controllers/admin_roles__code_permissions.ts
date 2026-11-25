/** Lifted from nest/generated/admin_roles__code_permissions.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { assertPermission } from "@/lib/auth/require";
import { PERMISSIONS, type Permission } from "@/lib/auth/permissions";
import { effectiveRolePermissions, isPermission, isSystemRoleCode, parsePermissions } from "@/lib/auth/permission-catalog";
import { templatePermissionsForReset } from "@/lib/auth/ensure-system-retail-roles";
import { recordAudit } from "@/lib/satellite-audit";
import { findRoleByOrgAndCode, updateRolePermissions } from "@/lib/retail-role.service";
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const patchSchema = z.object({
  permissions: z.array(z.string()).optional(),
  resetToDefaults: z.boolean().optional(),
});

type RouteParams = { params: Promise<{ code: string }> };


@Controller()
export class AdminRolesCodePermissionsController {
  @Get("api/admin/roles/:code/permissions")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterRetailStaff(httpReq, httpRes))) return;
    try {
      const session = await retailNestSession(httpReq);
      const web = await runWithRetailTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.ACCESS_MANAGE);
    const { code } = httpReq.params;
    const role = await findRoleByOrgAndCode(session.organizationId, code);
    if (!role) return sendJson(httpRes, { error: "Role not found" }, 404);

    return sendJson(httpRes, {
      code: role.code,
      name: role.name,
      isSystem: role.isSystem,
      cloneFromCode: role.cloneFromCode,
      permissions: effectiveRolePermissions(role),
    });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Patch("api/admin/roles/:code/permissions")
  @HttpCode(200)
  async patch_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterRetailStaff(httpReq, httpRes))) return;
    try {
      const session = await retailNestSession(httpReq);
      const web = await runWithRetailTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.ACCESS_MANAGE);
    const { code } = httpReq.params;
    const body = patchSchema.parse(httpReq.body);
    const role = await findRoleByOrgAndCode(session.organizationId, code);
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
    const updated = await updateRolePermissions(role.id, next);
    await recordAudit(
      { userId: session.sub, request: req },
      "Role",
      role.id,
      "ROLE_PERMISSIONS_PATCH",
      { code: role.code, before, after: next, resetToDefaults: body.resetToDefaults === true },
    );

    return sendJson(httpRes, { code: updated.code, permissions: parsePermissions(updated.permissionsJson) });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
