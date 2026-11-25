import { expressKitHeaders } from "@era/satellite-kit";
import { Controller, Get, HttpCode, Patch, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicBody,
  clinicRoute,
} from "../../bridge";
import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { CLINIC_PERMISSION, DEFAULT_ROLE_PERMISSIONS, effectiveRolePermissions, isClinicPermission, parseRolePermissions, rolePermissionsAreCustomized, serializeRolePermissions, type ClinicPermission } from "@/lib/auth/clinic-permissions";
import { isSystemClinicRoleCode } from "@/lib/clinic-roles";
import { findOrgRoleByCode, findOrgRoleForAdmin, updateOrgRolePermissions } from "@/domain/auth/clinic-rbac.service";
import { recordClinicAudit } from "@/lib/satellite-audit";


const patchSchema = z.object({
  permissions: z.array(z.string()).optional(),
  resetToDefaults: z.boolean().optional(),
});

type RouteParams = { params: Promise<{ code: string }> };

@Controller()
export class AdminRolesCodePermissionsController {

  @Get("api/admin/roles/:code/permissions")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const gate = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (gate.error) return clinicBody(gate.error);

    const { code } = httpReq.params;
    const organizationId = gate.session.organizationId;
    const role = await findOrgRoleForAdmin(organizationId, code);
    if (!role) throw new HttpException({ error: "Role not found" }, 404);

    const permissions = effectiveRolePermissions(role.code, role.permissionsJson);
    return {
      code: role.code,
      name: role.name,
      isSystem: role.isSystem,
      staffKind: role.staffKind,
      cloneFromCode: role.cloneFromCode,
      permissions,
      customized: rolePermissionsAreCustomized(role.code, role.permissionsJson),
    };
  
        });
  }

  @Patch("api/admin/roles/:code/permissions")
  @HttpCode(200)
  async patch_1(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const gate = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (gate.error) return clinicBody(gate.error);

    const denied = await requireClinicPermission(
      gate.session,
      CLINIC_PERMISSION.ADMIN_ACCESS_MANAGE,
    );
    if (denied) return clinicBody(denied);

    const { code } = httpReq.params;
    const organizationId = gate.session.organizationId;
    const body = patchSchema.parse(httpReq.body);
    const role = await findOrgRoleForAdmin(organizationId, code);
    if (!role) throw new HttpException({ error: "Role not found" }, 404);

    let next: ClinicPermission[];
    if (body.resetToDefaults) {
      if (isSystemClinicRoleCode(code) && DEFAULT_ROLE_PERMISSIONS[code]) {
        next = [...DEFAULT_ROLE_PERMISSIONS[code]];
      } else if (role.cloneFromCode) {
        const donor = await findOrgRoleByCode(organizationId, role.cloneFromCode);
        if (!donor) {
          throw new HttpException({ error: "cloneFrom role missing; cannot reset" }, 400);
        }
        next = effectiveRolePermissions(donor.code, donor.permissionsJson);
      } else {
        throw new HttpException({ error: "No defaults available for this role" }, 400);
      }
    } else if (body.permissions) {
      const invalid = body.permissions.filter((p) => !isClinicPermission(p));
      if (invalid.length > 0) {
        throw new HttpException({ error: "Unknown permission codes", ...{ invalid } }, 400);
      }
      next = body.permissions as ClinicPermission[];
    } else {
      throw new HttpException({ error: "permissions or resetToDefaults required" }, 400);
    }

    const before = parseRolePermissions(role.permissionsJson);
    const updated = await updateOrgRolePermissions(
      role.id,
      serializeRolePermissions(next),
    );

    await recordClinicAudit(
      { userId: gate.session.sub, request: expressKitHeaders(httpReq) },
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

    return {
      code: updated.code,
      permissions: next,
      customized: true,
    };
  
        });
  }
}
