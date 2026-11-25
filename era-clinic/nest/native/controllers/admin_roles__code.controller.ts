import { Controller, Delete, HttpCode, Patch, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicBody,
  clinicRoute,
} from "../../bridge";
import { z } from "zod";
import { publishSatelliteRole } from "@era/satellite-kit";
import { expressKitHeaders } from "../../express-kit-headers";
import { requireClinicPermission } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { canMutateCustomRoleMeta, canDeleteClinicRole, parseAssignableStaffKind } from "@/lib/auth/clinic-role-admin";
import { parseClinicRoleStaffKind, type ClinicRoleStaffKind } from "@/lib/clinic-roles";
import { deleteOrgRole, findOrgRoleForAdmin, findOrgRoleWithUserCount, updateOrgRoleMeta } from "@/domain/auth/clinic-rbac.service";
import { recordClinicAudit } from "@/lib/satellite-audit";


type RouteParams = { params: Promise<{ code: string }> };

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  staffKind: z.enum(["DOCTOR", "NURSE", "LAB", "BATH", "MASSAGE", "NONE"]).optional(),
});

@Controller()
export class AdminRolesCodeController {

  @Patch("api/admin/roles/:code")
  @HttpCode(200)
  async patch_0(
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
    if (body.name === undefined && body.staffKind === undefined) {
      throw new HttpException({ error: "name or staffKind required" }, 400);
    }

    const role = await findOrgRoleForAdmin(organizationId, code);
    if (!role) throw new HttpException({ error: "Role not found" }, 404);

    if (body.staffKind !== undefined && !canMutateCustomRoleMeta(role)) {
      throw new HttpException({ error: "Cannot change staffKind on a system role" }, 400);
    }
    if (body.name !== undefined && !canMutateCustomRoleMeta(role)) {
      throw new HttpException({ error: "Cannot rename a system role" }, 400);
    }

    const before = {
      name: role.name,
      staffKind: parseClinicRoleStaffKind(role.staffKind),
    };
    const data: { name?: string; staffKind?: ClinicRoleStaffKind } = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.staffKind !== undefined) {
      const kind = parseAssignableStaffKind(body.staffKind);
      if (!kind) throw new HttpException({ error: "Invalid staffKind" }, 400);
      data.staffKind = kind;
    }

    const updated = await updateOrgRoleMeta(role.id, data);

    await recordClinicAudit(
      { userId: gate.session.sub, request: expressKitHeaders(httpReq) },
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

    return {
      code: updated.code,
      name: updated.name,
      isSystem: updated.isSystem,
      staffKind: parseClinicRoleStaffKind(updated.staffKind),
      cloneFromCode: updated.cloneFromCode,
    };
  
        });
  }

  @Delete("api/admin/roles/:code")
  @HttpCode(200)
  async delete_1(
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
    const role = await findOrgRoleWithUserCount(organizationId, code);
    if (!role) throw new HttpException({ error: "Role not found" }, 404);
    const deletable = canDeleteClinicRole({
      isSystem: role.isSystem,
      code: role.code,
      userCount: role._count.users,
    });
    if (!deletable.ok) {
      if (deletable.reason === "system") {
        throw new HttpException({ error: "Cannot delete a system role" }, 400);
      }
      throw new HttpException({ error: "Role still has users", ...{
        userCount: role._count.users,
      } }, 409);
    }

    await deleteOrgRole(role.id);
    await recordClinicAudit(
      { userId: gate.session.sub, request: expressKitHeaders(httpReq) },
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

    return { deleted: true, code: role.code };
  
        });
  }
}
