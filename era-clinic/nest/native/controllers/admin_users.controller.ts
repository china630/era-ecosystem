import { Controller, Get, HttpCode, Req } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { ensureSystemClinicRoles } from "@/lib/auth/ensure-system-clinic-roles";
import { parseClinicRoleStaffKind } from "@/lib/clinic-roles";
import { listOrgStaffUsers } from "@/domain/auth/clinic-rbac.service";
import { prisma } from "@/lib/prisma";


/** List local staff users for role assignment on /admin/access. */

@Controller()
export class AdminUsersController {

  @Get("api/admin/users")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const gate = await assertClinicAdminRoute(clinicRoute(httpReq));
    if (gate.error) return clinicBody(gate.error);

    const organizationId = gate.session.organizationId;
    await ensureSystemClinicRoles(prisma, organizationId);

    const users = await listOrgStaffUsers(organizationId);

    return users.map((u) => ({
        id: u.id,
        login: u.login,
        fullName: u.fullName,
        email: u.email,
        status: u.status,
        isCrossSystem: u.isCrossSystem,
        roleCode: u.role.code,
        roleName: u.role.name,
        roleIsSystem: u.role.isSystem,
        staffKind: parseClinicRoleStaffKind(u.role.staffKind),
      }));
  
        });
  }
}
