import { Controller, Get, HttpCode, Post, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicBody,
  clinicRoute,
} from "../../bridge";
import { z } from "zod";
import { expressKitHeaders, publishSatelliteRole, publishSatelliteRoleSnapshot } from "@era/satellite-kit";
import { requireClinicPermission } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { CLINIC_PERMISSION, effectiveRolePermissions, rolePermissionsAreCustomized, serializeRolePermissions } from "@/lib/auth/clinic-permissions";
import { ensureSystemClinicRoles } from "@/lib/auth/ensure-system-clinic-roles";
import { CLINIC_CUSTOM_ROLE_CODE_RE, isValidCustomClinicRoleCode, normalizeClinicRoleCode } from "@/lib/auth/clinic-role-admin";
import { parseClinicRoleStaffKind } from "@/lib/clinic-roles";
import { createOrgRole, findOrgRoleByCode, listOrgRolesWithUserCounts } from "@/domain/auth/clinic-rbac.service";
import { prisma } from "@/lib/prisma";
import { recordClinicAudit } from "@/lib/satellite-audit";


const createSchema = z.object({
  code: z.string().regex(CLINIC_CUSTOM_ROLE_CODE_RE, "Invalid role code"),
  name: z.string().trim().min(1).max(120),
  cloneFrom: z.string().trim().min(1).max(32),
  staffKind: z.enum(["DOCTOR", "NURSE", "LAB", "BATH", "MASSAGE", "NONE"]).optional(),
});

@Controller()
export class AdminRolesController {

  @Get("api/admin/roles")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const gate = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (gate.error) return clinicBody(gate.error);

    const organizationId = gate.session.organizationId;
    await ensureSystemClinicRoles(prisma, organizationId);

    const roles = await listOrgRolesWithUserCounts(organizationId);

    void publishSatelliteRoleSnapshot({
      organizationId,
      satelliteKey: "industry_clinic",
      roles: roles.map((role) => ({
        code: role.code,
        name: role.name,
        active: true,
      })),
    });

    return roles.map((role) => {
        const permissions = effectiveRolePermissions(
          role.code,
          role.permissionsJson,
        );
        return {
          id: role.id,
          code: role.code,
          name: role.name,
          isSystem: role.isSystem,
          staffKind: parseClinicRoleStaffKind(role.staffKind),
          cloneFromCode: role.cloneFromCode,
          userCount: role._count.users,
          permissionCount: permissions.length,
          permissions,
          customized: rolePermissionsAreCustomized(
            role.code,
            role.permissionsJson,
          ),
        };
      });
  
        });
  }

  @Post("api/admin/roles")
  @HttpCode(200)
  async post_1(
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

    const organizationId = gate.session.organizationId;
    await ensureSystemClinicRoles(prisma, organizationId);

    const body = createSchema.parse(httpReq.body);
    const code = normalizeClinicRoleCode(body.code);
    if (!isValidCustomClinicRoleCode(code)) {
      throw new HttpException({ error: "Cannot create a role with a reserved system code" }, 400);
    }

    const existing = await findOrgRoleByCode(organizationId, code);
    if (existing) {
      throw new HttpException({ error: "Role code already exists" }, 409);
    }

    const donor = await findOrgRoleByCode(organizationId, body.cloneFrom);
    if (!donor) {
      throw new HttpException({ error: "cloneFrom role not found" }, 404);
    }

    const permissions = effectiveRolePermissions(
      donor.code,
      donor.permissionsJson,
    );
    const created = await createOrgRole({
      organizationId,
      code,
      name: body.name,
      staffKind: body.staffKind ?? parseClinicRoleStaffKind(donor.staffKind),
      cloneFromCode: donor.code,
      permissionsJson: serializeRolePermissions(permissions),
    });

    await recordClinicAudit(
      { userId: gate.session.sub, request: expressKitHeaders(httpReq) },
      "Role",
      created.id,
      "ROLE_CREATE",
      {
        code: created.code,
        name: created.name,
        cloneFrom: donor.code,
        permissionCount: permissions.length,
      },
    );

    void publishSatelliteRole({
      organizationId,
      satelliteKey: "industry_clinic",
      code: created.code,
      name: created.name,
      active: true,
    });

    return {
      id: created.id,
      code: created.code,
      name: created.name,
      isSystem: false,
      staffKind: parseClinicRoleStaffKind(created.staffKind),
      cloneFromCode: created.cloneFromCode,
      permissions,
      customized: true,
    };
  
        });
  }
}
