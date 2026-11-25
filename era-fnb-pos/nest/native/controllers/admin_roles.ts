/** Lifted from nest/generated/admin_roles.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { publishSatelliteRole, publishSatelliteRoleSnapshot } from "@era/satellite-kit";
import { assertAnyPermission, assertPermission } from "@/lib/auth/require";
import { PERMISSIONS, effectiveRolePermissions, parsePermissions, serializePermissions } from "@/lib/auth/permissions";
import { FNB_CUSTOM_ROLE_CODE_RE, isValidCustomFnbRoleCode, normalizeFnbRoleCode } from "@/lib/auth/fnb-role-admin";
import { createOrganizationRole, ensureFnbRolesForOrg, findOrganizationRoleByCode, listOrganizationRoles } from "@/lib/fnb-roles";
import { recordFbAudit } from "@/lib/satellite-audit";
import { editionForOrg } from "@/lib/auth/fnb-permission.service";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const createSchema = z.object({
  code: z.string().regex(FNB_CUSTOM_ROLE_CODE_RE, "Invalid role code"),
  name: z.string().trim().min(1).max(120),
  cloneFrom: z.string().trim().min(1).max(64),
});


@Controller()
export class AdminRolesController {
  @Get("api/admin/roles")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    assertAnyPermission(session, [PERMISSIONS.ACCESS_MANAGE]);

    const organizationId = session.organizationId;
    const edition = await editionForOrg(organizationId);
    await ensureFnbRolesForOrg(organizationId, edition);

    const roles = await listOrganizationRoles(organizationId);

    void publishSatelliteRoleSnapshot({
      organizationId,
      satelliteKey: "industry_fnb_pos",
      roles: roles.map((role) => ({
        code: role.code,
        name: role.name,
        active: true,
      })),
    });

    return sendJson(httpRes, 
      roles.map((role) => {
        const permissions = effectiveRolePermissions(
          role.code,
          role.permissionsJson,
          edition,
        );
        return {
          id: role.id,
          code: role.code,
          name: role.name,
          isSystem: role.isSystem,
          cloneFromCode: role.cloneFromCode,
          userCount: role._count.users,
          permissionCount: permissions.length,
          permissions,
          customized: parsePermissions(role.permissionsJson).length > 0,
        };
      }),
    );
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }

  @Post("api/admin/roles")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.ACCESS_MANAGE);

    const organizationId = session.organizationId;
    const edition = await editionForOrg(organizationId);
    await ensureFnbRolesForOrg(organizationId, edition);

    const body = createSchema.parse(httpReq.body);
    const code = normalizeFnbRoleCode(body.code);
    if (!isValidCustomFnbRoleCode(code)) {
      return sendJson(httpRes, { error: "Cannot create a role with a reserved system code" }, 400);
    }

    const existing = await findOrganizationRoleByCode(organizationId, code);
    if (existing) {
      return sendJson(httpRes, { error: "Role code already exists" }, 409);
    }

    const donor = await findOrganizationRoleByCode(organizationId, body.cloneFrom);
    if (!donor) {
      return sendJson(httpRes, { error: "cloneFrom role not found" }, 404);
    }

    const permissions = effectiveRolePermissions(
      donor.code,
      donor.permissionsJson,
      edition,
    );
    const created = await createOrganizationRole({
      organizationId,
      code,
      name: body.name,
      cloneFromCode: donor.code,
      permissionsJson: serializePermissions(permissions),
    });

    await recordFbAudit(
      { userId: session!.sub, request: { headers: { get: (name: string) => nestHeader(httpReq, name) } } },
      "Role",
      created.id,
      "ROLE_CREATE",
      { code: created.code, cloneFrom: donor.code },
    );

    void publishSatelliteRole({
      organizationId,
      satelliteKey: "industry_fnb_pos",
      code: created.code,
      name: created.name,
      active: true,
    });

    return sendJson(httpRes, 
      {
        id: created.id,
        code: created.code,
        name: created.name,
        isSystem: false,
        cloneFromCode: created.cloneFromCode,
        permissions,
      },
      201,
    );
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
