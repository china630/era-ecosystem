/** Lifted from nest/generated/admin_roles__code.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { publishSatelliteRole } from "@era/satellite-kit";
import { assertPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { canDeleteFnbRole, canMutateCustomRoleMeta } from "@/lib/auth/fnb-role-admin";
import { deleteOrganizationRoleById, findOrganizationRoleByCode, findOrganizationRoleByCodeWithUserCount, renameOrganizationRole } from "@/lib/fnb-roles";
import { recordFbAudit } from "@/lib/satellite-audit";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

type RouteParams = { params: Promise<{ code: string }> };

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120),
});


@Controller()
export class AdminRolesCodeController {
  @Patch("api/admin/roles/:code")
  @HttpCode(200)
  async patch_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.ACCESS_MANAGE);

    const { code } = httpReq.params;
    const organizationId = session.organizationId;
    const body = patchSchema.parse(httpReq.body);

    const role = await findOrganizationRoleByCode(organizationId, code);
    if (!role) return sendJson(httpRes, { error: "Role not found" }, 404);

    if (!canMutateCustomRoleMeta(role)) {
      return sendJson(httpRes, { error: "Cannot rename a system role" }, 400);
    }

    const before = { name: role.name };
    const updated = await renameOrganizationRole(role.id, body.name);

    await recordFbAudit(
      { userId: session!.sub, request: { headers: { get: (name: string) => nestHeader(httpReq, name) } } },
      "Role",
      role.id,
      "ROLE_UPDATE",
      { code: role.code, before, after: { name: updated.name } },
    );

    void publishSatelliteRole({
      organizationId,
      satelliteKey: "industry_fnb_pos",
      code: updated.code,
      name: updated.name,
      active: true,
    });

    return sendJson(httpRes, {
      code: updated.code,
      name: updated.name,
      isSystem: updated.isSystem,
      cloneFromCode: updated.cloneFromCode,
    });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }

  @Delete("api/admin/roles/:code")
  @HttpCode(200)
  async delete_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.ACCESS_MANAGE);

    const { code } = httpReq.params;
    const organizationId = session.organizationId;
    const role = await findOrganizationRoleByCodeWithUserCount(organizationId, code);
    if (!role) return sendJson(httpRes, { error: "Role not found" }, 404);
    const deletable = canDeleteFnbRole({
      isSystem: role.isSystem,
      code: role.code,
      userCount: role._count.users,
    });
    if (!deletable.ok) {
      if (deletable.reason === "system") {
        return sendJson(httpRes, { error: "Cannot delete a system role" }, 400);
      }
      return sendJson(httpRes, 
        { error: "Role still has users", userCount: role._count.users }, 409);
    }

    await deleteOrganizationRoleById(role.id);
    await recordFbAudit(
      { userId: session!.sub, request: { headers: { get: (name: string) => nestHeader(httpReq, name) } } },
      "Role",
      role.id,
      "ROLE_DELETE",
      { code: role.code, name: role.name },
    );

    void publishSatelliteRole({
      organizationId,
      satelliteKey: "industry_fnb_pos",
      code: role.code,
      name: role.name,
      active: false,
    });

    return sendJson(httpRes, { deleted: true, code: role.code });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
