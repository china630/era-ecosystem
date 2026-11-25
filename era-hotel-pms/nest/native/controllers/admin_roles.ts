/** Lifted from era-hotel-pms/nest/generated/admin_roles.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { publishSatelliteRole, publishSatelliteRoleSnapshot } from "@era/satellite-kit";
import { assertAnyPermission, assertPermission } from "@/lib/auth/require";
import { PERMISSIONS, effectiveRolePermissions, parsePermissions, serializePermissions } from "@/lib/auth/permissions";
import { HOTEL_CUSTOM_ROLE_CODE_RE, isValidCustomHotelRoleCode, normalizeHotelRoleCode } from "@/lib/auth/hotel-role-admin";
import { ensureHotelRolesForOrg, listHotelRoles, findHotelRoleByCode, createHotelRole } from "@/lib/services/hotel-role.service";
import { recordHotelAudit } from "@/lib/satellite-audit";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const createSchema = z.object({
  code: z.string().regex(HOTEL_CUSTOM_ROLE_CODE_RE, "Invalid role code"),
  name: z.string().trim().min(1).max(120),
  cloneFrom: z.string().trim().min(1).max(64),
});


@Controller()
export class AdminRolesController {
  @Get("api/admin/roles")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertAnyPermission(session, [
      PERMISSIONS.ACCESS_MANAGE,
      PERMISSIONS.USERS_MANAGE,
    ]);

    const organizationId = session.organizationId;
    await ensureHotelRolesForOrg(organizationId);

    const roles = await listHotelRoles(organizationId);

    void publishSatelliteRoleSnapshot({
      organizationId,
      satelliteKey: "industry_hotel_pms",
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
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.ACCESS_MANAGE);

    const organizationId = session.organizationId;
    await ensureHotelRolesForOrg(organizationId);

    const body = createSchema.parse(httpReq.body);
    const code = normalizeHotelRoleCode(body.code);
    if (!isValidCustomHotelRoleCode(code)) {
      return sendJson(httpRes, { error: "Cannot create a role with a reserved system code" }, 400);
    }

    const existing = await findHotelRoleByCode(organizationId, code);
    if (existing) {
      return sendJson(httpRes, { error: "Role code already exists" }, 409);
    }

    const donor = await findHotelRoleByCode(organizationId, body.cloneFrom);
    if (!donor) {
      return sendJson(httpRes, { error: "cloneFrom role not found" }, 404);
    }

    const permissions = effectiveRolePermissions(
      donor.code,
      donor.permissionsJson,
    );
    const created = await createHotelRole({
      organizationId,
      code,
      name: body.name,
      cloneFromCode: donor.code,
      permissionsJson: serializePermissions(permissions),
    });

    await recordHotelAudit(
      { userId: session!.sub, request: { headers: { get: (name: string) => nestHeader(httpReq, name) } } },
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
      satelliteKey: "industry_hotel_pms",
      code: created.code,
      name: created.name,
      active: true,
    });

    return sendJson(httpRes, {
      id: created.id,
      code: created.code,
      name: created.name,
      isSystem: false,
      cloneFromCode: created.cloneFromCode,
      permissions,
      customized: true,
    });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
