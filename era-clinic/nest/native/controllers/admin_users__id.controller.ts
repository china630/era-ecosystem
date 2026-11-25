import { expressKitHeaders } from "../../express-kit-headers";
import { Controller, HttpCode, Patch, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicBody,
  clinicRoute,
} from "../../bridge";
import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { ensureSystemClinicRoles } from "@/lib/auth/ensure-system-clinic-roles";
import { parseClinicRoleStaffKind } from "@/lib/clinic-roles";
import { assignUserRole, findOrgRoleByCode, findOrgUserWithRole } from "@/domain/auth/clinic-rbac.service";
import { prisma } from "@/lib/prisma";
import { recordClinicAudit } from "@/lib/satellite-audit";


type RouteParams = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  roleCode: z.string().trim().min(1).max(32),
});

/** Assign an existing org Role to a local user (ops RBAC). */

@Controller()
export class AdminUsersIdController {

  @Patch("api/admin/users/:id")
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

    const { id } = httpReq.params;
    const organizationId = gate.session.organizationId;
    await ensureSystemClinicRoles(prisma, organizationId);

    const body = patchSchema.parse(httpReq.body);
    const roleCode = body.roleCode.trim().toUpperCase();

    const user = await findOrgUserWithRole(organizationId, id);
    if (!user) throw new HttpException({ error: "User not found" }, 404);

    const role = await findOrgRoleByCode(organizationId, roleCode);
    if (!role) {
      throw new HttpException({ error: 
        "Role not found — create it on Access matrix first" }, 404);
    }

    if (user.roleId === role.id) {
      return {
        id: user.id,
        login: user.login,
        roleCode: role.code,
        staffKind: parseClinicRoleStaffKind(role.staffKind),
        unchanged: true,
      };
    }

    const updated = await assignUserRole(user.id, role.id);

    await recordClinicAudit(
      { userId: gate.session.sub, request: expressKitHeaders(httpReq) },
      "User",
      user.id,
      "ROLE_ASSIGN",
      {
        login: user.login,
        beforeRole: user.role.code,
        afterRole: role.code,
      },
    );

    return {
      id: updated.id,
      login: updated.login,
      roleCode: updated.role.code,
      roleName: updated.role.name,
      staffKind: parseClinicRoleStaffKind(updated.role.staffKind),
    };
  
        });
  }
}
