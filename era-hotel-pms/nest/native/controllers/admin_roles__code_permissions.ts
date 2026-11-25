/** Lifted from era-hotel-pms/nest/generated/admin_roles__code_permissions.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { assertPermission } from "@/lib/auth/require";
import { PERMISSIONS, ROLE_PERMISSIONS, effectiveRolePermissions, isHotelPermission, parsePermissions, serializePermissions, type Permission, type RoleCode } from "@/lib/auth/permissions";
import { isSystemHotelRoleCode } from "@/lib/hotel-roles";
import { findHotelRoleByCode, updateHotelRolePermissions } from "@/lib/services/hotel-role.service";
import { recordHotelAudit } from "@/lib/satellite-audit";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

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
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.ACCESS_MANAGE);

    const { code } = httpReq.params;
    const organizationId = session.organizationId;
    const role = await findHotelRoleByCode(organizationId, code);
    if (!role) return sendJson(httpRes, { error: "Role not found" }, 404);

    const permissions = effectiveRolePermissions(role.code, role.permissionsJson);
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
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.ACCESS_MANAGE);

    const { code } = httpReq.params;
    const organizationId = session.organizationId;
    const body = patchSchema.parse(httpReq.body);
    const role = await findHotelRoleByCode(organizationId, code);
    if (!role) return sendJson(httpRes, { error: "Role not found" }, 404);

    let next: Permission[];
    if (body.resetToDefaults) {
      if (isSystemHotelRoleCode(code) && ROLE_PERMISSIONS[code as RoleCode]) {
        next = [...ROLE_PERMISSIONS[code as RoleCode]];
      } else if (role.cloneFromCode) {
        const donor = await findHotelRoleByCode(organizationId, role.cloneFromCode);
        if (!donor) {
          return sendJson(httpRes, { error: "cloneFrom role missing; cannot reset" }, 400);
        }
        next = effectiveRolePermissions(donor.code, donor.permissionsJson);
      } else {
        return sendJson(httpRes, { error: "No defaults available for this role" }, 400);
      }
    } else if (body.permissions) {
      const invalid = body.permissions.filter((p) => !isHotelPermission(p));
      if (invalid.length > 0) {
        return sendJson(httpRes, 
          { error: "Unknown permission codes", invalid }, 400);
      }
      next = body.permissions as Permission[];
    } else {
      return sendJson(httpRes, { error: "permissions or resetToDefaults required" }, 400);
    }

    const before = parsePermissions(role.permissionsJson);
    const updated = await updateHotelRolePermissions(
      role.id,
      serializePermissions(next),
    );

    await recordHotelAudit(
      { userId: session!.sub, request: { headers: { get: (name: string) => nestHeader(httpReq, name) } } },
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
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
