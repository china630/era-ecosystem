/** Lifted from nest/generated/admin_roles__code_permissions.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { assertPermission } from "@/lib/auth/require";
import { PERMISSIONS, effectiveRolePermissions, isFnbPermission, isSystemFnbRoleCode, parsePermissions, serializePermissions, type Permission } from "@/lib/auth/permissions";
import { templatePermissionsForReset } from "@/lib/auth/ensure-system-fnb-roles";
import { findOrganizationRoleByCode, patchOrganizationRolePermissions } from "@/lib/fnb-roles";
import { recordFbAudit } from "@/lib/satellite-audit";
import { editionForOrg } from "@/lib/auth/fnb-permission.service";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

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
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.ACCESS_MANAGE);

    const { code } = httpReq.params;
    const organizationId = session.organizationId;
    const edition = await editionForOrg(organizationId);
    const role = await findOrganizationRoleByCode(organizationId, code);
    if (!role) return sendJson(httpRes, { error: "Role not found" }, 404);

    const permissions = effectiveRolePermissions(
      role.code,
      role.permissionsJson,
      edition,
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
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }

  @Patch("api/admin/roles/:code/permissions")
  @HttpCode(200)
  async patch_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.ACCESS_MANAGE);

    const { code } = httpReq.params;
    const organizationId = session.organizationId;
    const edition = await editionForOrg(organizationId);
    const body = patchSchema.parse(httpReq.body);
    const role = await findOrganizationRoleByCode(organizationId, code);
    if (!role) return sendJson(httpRes, { error: "Role not found" }, 404);

    let next: Permission[];
    if (body.resetToDefaults) {
      next = templatePermissionsForReset(role, edition);
      if (next.length === 0 && !isSystemFnbRoleCode(code)) {
        return sendJson(httpRes, { error: "No defaults available for this role" }, 400);
      }
    } else if (body.permissions) {
      const invalid = body.permissions.filter((p) => !isFnbPermission(p));
      if (invalid.length > 0) {
        return sendJson(httpRes, 
          { error: "Unknown permission codes", invalid }, 400);
      }
      next = body.permissions as Permission[];
    } else {
      return sendJson(httpRes, { error: "permissions or resetToDefaults required" }, 400);
    }

    const before = parsePermissions(role.permissionsJson);
    const updated = await patchOrganizationRolePermissions(
      role.id,
      serializePermissions(next),
    );

    await recordFbAudit(
      { userId: session!.sub, request: { headers: { get: (name: string) => nestHeader(httpReq, name) } } },
      "Role",
      role.id,
      "ROLE_PERMISSIONS_PATCH",
      {
        code: role.code,
        before,
        after: next,
        resetToDefaults: body.resetToDefaults === true,
      },
    );

    return sendJson(httpRes, {
      code: updated.code,
      permissions: parsePermissions(updated.permissionsJson),
    });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
