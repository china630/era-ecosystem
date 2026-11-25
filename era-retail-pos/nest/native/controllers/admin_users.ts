/** Lifted from nest/generated/admin_users.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { assertPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { hasPermissionBypass } from "@/lib/auth/permission-check";
import { normalizeRoleCode, roleAssignDenied } from "@/lib/auth/retail-role-admin";
import { recordAudit } from "@/lib/satellite-audit";
import { createLocalUser, findRoleByCode, findUserByLogin, findUserWithRole, listUsersForOrganization, updateUserAdmin } from "@/lib/retail-user-admin.service";
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const patchSchema = z.object({
  userId: z.string().trim().min(1),
  roleCode: z.string().trim().min(1).max(64).optional(),
  status: z.enum(["ACTIVE", "DISABLED"]).optional(),
  fullName: z.string().trim().min(1).max(200).optional(),
});

const createSchema = z.object({
  login: z.string().trim().min(1).max(64),
  fullName: z.string().trim().min(1).max(200),
  password: z.string().min(4).max(128),
  roleCode: z.string().trim().min(1).max(64),
});


@Controller()
export class AdminUsersController {
  @Get("api/admin/users")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterRetailStaff(httpReq, httpRes))) return;
    try {
      const session = await retailNestSession(httpReq);
      const web = await runWithRetailTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.ACCESS_MANAGE);
    const users = await listUsersForOrganization(session.organizationId);
    return sendJson(httpRes, 
      users.map((u) => ({
        id: u.id,
        login: u.login,
        fullName: u.fullName,
        status: u.status,
        isCrossSystem: u.isCrossSystem,
        cpEmploymentId: u.cpEmploymentId,
        positionTitle: u.positionTitle,
        role: u.role.name || u.role.code,
        roleCode: u.role.code,
      })),
    );
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Patch("api/admin/users")
  @HttpCode(200)
  async patch_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterRetailStaff(httpReq, httpRes))) return;
    try {
      const session = await retailNestSession(httpReq);
      const web = await runWithRetailTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.ACCESS_MANAGE);
    const organizationId = session.organizationId;
    const body = patchSchema.parse(httpReq.body);
    const roleCode = body.roleCode ? normalizeRoleCode(body.roleCode) : null;

    const role = roleCode
      ? await findRoleByCode(organizationId, roleCode)
      : null;
    if (roleCode && !role) return sendJson(httpRes, { error: "Unknown role code" }, 400);
    const user = await findUserWithRole(organizationId, body.userId);
    if (!user) return sendJson(httpRes, { error: "User not found" }, 404);

    if (role) {
      const denied = roleAssignDenied({
        actorBypass: hasPermissionBypass(session),
        fromRoleCode: user.role.code,
        toRoleCode: role.code,
      });
      if (denied) return sendJson(httpRes, { error: denied }, 403);
    }

    await updateUserAdmin(user.id, {
      ...(role ? { roleId: role.id } : {}),
      ...(body.status ? { status: body.status } : {}),
      ...(body.fullName && !user.cpEmploymentId ? { fullName: body.fullName } : {}),
    });
    await recordAudit({ userId: session.sub, request: req }, "User", user.id, "USER_UPDATE", {
      before: user.role.code,
      after: role?.code ?? user.role.code,
      status: body.status ?? user.status,
    });

    return sendJson(httpRes, {
      userId: user.id,
      roleCode: role?.code ?? user.role.code,
      status: body.status ?? user.status,
    });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/admin/users")
  @HttpCode(200)
  async post_2(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterRetailStaff(httpReq, httpRes))) return;
    try {
      const session = await retailNestSession(httpReq);
      const web = await runWithRetailTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.ACCESS_MANAGE);
    const organizationId = session.organizationId;
    const body = createSchema.parse(httpReq.body);
    const roleCode = normalizeRoleCode(body.roleCode);
    const role = await findRoleByCode(organizationId, roleCode);
    if (!role) return sendJson(httpRes, { error: "Unknown role code" }, 400);
    const denied = roleAssignDenied({
      actorBypass: hasPermissionBypass(session),
      fromRoleCode: role.code,
      toRoleCode: role.code,
    });
    if (denied) return sendJson(httpRes, { error: denied }, 403);
    const existing = await findUserByLogin(organizationId, body.login);
    if (existing) return sendJson(httpRes, { error: "Login already taken" }, 409);
    const user = await createLocalUser({
      organizationId,
      login: body.login,
      fullName: body.fullName,
      password: body.password,
      roleId: role.id,
    });
    await recordAudit({ userId: session.sub, request: req }, "User", user.id, "USER_CREATE", {
      login: user.login,
      roleCode: role.code,
    });
    return sendJson(httpRes, { id: user.id, login: user.login, roleCode: role.code });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
