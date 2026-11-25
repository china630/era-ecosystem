import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpException,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { expressKitHeaders, publishSatelliteRole, publishSatelliteRoleSnapshot, resolveOperatingMode } from "@era/satellite-kit";
import { assertPermission } from "@/lib/auth/require";
import { PERMISSIONS, type Permission } from "@/lib/auth/permissions";
import {
  effectiveRolePermissions,
  isPermission,
  isSystemRoleCode,
  parsePermissions,
  serializePermissions,
} from "@/lib/auth/permission-catalog";
import { ensureSystemRoles, templatePermissionsForReset } from "@/lib/auth/ensure-system-construction-roles";
import {
  CUSTOM_ROLE_CODE_RE,
  canDeleteRole,
  canMutateCustomRoleMeta,
  isValidCustomRoleCode,
  normalizeRoleCode,
  roleAssignDenied,
} from "@/lib/auth/construction-role-admin";
import { hasPermissionBypass } from "@/lib/auth/permission-check";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/satellite-audit";
import {
  createCustomRole,
  deleteRoleById,
  findOrgRoleByCode,
  findOrgRoleByCodeWithUserCount,
  listOrgRolesWithUserCounts,
  updateRoleName,
  updateRolePermissions,
} from "@/lib/admin-roles.service";
import {
  assignUserRole,
  findOrgRoleByCode as findUserOrgRoleByCode,
  findOrgUserWithRole,
  listOrgUsers,
} from "@/lib/admin-users.service";
import { fetchCpChannels, patchCpChannel } from "@/lib/cp-channels-client";
import { requestOrganizationId } from "@/lib/request-organization";
import type { StaffSession } from "@/lib/api-utils";
import { Staff } from "../decorators/staff-session.decorator";
import { ConstructionStaffGuard } from "../guards/staff.guard";
import { withStaffTenant } from "../tenant";
import { type ConstructionRequest } from "../session";

const createRoleSchema = z.object({
  code: z.string().trim().toUpperCase().regex(CUSTOM_ROLE_CODE_RE, "Invalid role code"),
  name: z.string().trim().min(1).max(120),
  cloneFrom: z.string().trim().min(1).max(64),
});

@Controller("api/admin")
@UseGuards(ConstructionStaffGuard)
export class AdminController {
  @Get("roles")
  listRoles(@Req() req: ConstructionRequest, @Staff() session: StaffSession) {
    return withStaffTenant(req, session, async () => {
      assertPermission(session, PERMISSIONS.ACCESS_MANAGE);
      const organizationId = session.organizationId;
      await ensureSystemRoles(prisma, organizationId);
      const roles = await listOrgRolesWithUserCounts(organizationId);
      void publishSatelliteRoleSnapshot({
        organizationId,
        satelliteKey: "industry_construction",
        roles: roles.map((role) => ({ code: role.code, name: role.name, active: true })),
      });
      return roles.map((role) => ({
        id: role.id,
        code: role.code,
        name: role.name,
        isSystem: role.isSystem,
        cloneFromCode: role.cloneFromCode,
        userCount: role._count.users,
        permissions: effectiveRolePermissions(role),
      }));
    });
  }

  @Post("roles")
  @HttpCode(201)
  createRole(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Body() body: unknown,
  ) {
    return withStaffTenant(req, session, async () => {
      assertPermission(session, PERMISSIONS.ACCESS_MANAGE);
      const organizationId = session.organizationId;
      await ensureSystemRoles(prisma, organizationId);
      const parsed = createRoleSchema.parse(body);
      const code = normalizeRoleCode(parsed.code);
      if (!isValidCustomRoleCode(code)) {
        throw new BadRequestException({ error: "Cannot create a role with a reserved system code" });
      }
      const existing = await findOrgRoleByCode(organizationId, code);
      if (existing) throw new ConflictException({ error: "Role code already exists" });
      const donor = await findOrgRoleByCode(organizationId, normalizeRoleCode(parsed.cloneFrom));
      if (!donor) throw new NotFoundException({ error: "cloneFrom role not found" });
      const permissions = effectiveRolePermissions(donor);
      const created = await createCustomRole({
        organizationId,
        code,
        name: parsed.name,
        cloneFromCode: donor.code,
        permissions,
      });
      await recordAudit(
        { userId: session.sub, request: expressKitHeaders(req) },
        "Role",
        created.id,
        "ROLE_CREATE",
        { code: created.code, cloneFrom: donor.code },
      );
      void publishSatelliteRole({
        organizationId,
        satelliteKey: "industry_construction",
        code: created.code,
        name: created.name,
        active: true,
      });
      return {
        id: created.id,
        code: created.code,
        name: created.name,
        isSystem: false,
        cloneFromCode: created.cloneFromCode,
        userCount: 0,
        permissions,
      };
    });
  }

  @Patch("roles/:code")
  renameRole(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("code") code: string,
    @Body() body: unknown,
  ) {
    return withStaffTenant(req, session, async () => {
      assertPermission(session, PERMISSIONS.ACCESS_MANAGE);
      const parsed = z.object({ name: z.string().trim().min(1).max(120) }).parse(body);
      const role = await findOrgRoleByCode(session.organizationId, code);
      if (!role) throw new NotFoundException({ error: "Role not found" });
      if (!canMutateCustomRoleMeta(role)) {
        throw new BadRequestException({ error: "Cannot rename a system role" });
      }
      const updated = await updateRoleName(role.id, parsed.name);
      await recordAudit(
        { userId: session.sub, request: expressKitHeaders(req) },
        "Role",
        role.id,
        "ROLE_UPDATE",
        { code: role.code, before: { name: role.name }, after: { name: updated.name } },
      );
      void publishSatelliteRole({
        organizationId: session.organizationId,
        satelliteKey: "industry_construction",
        code: updated.code,
        name: updated.name,
        active: true,
      });
      return {
        code: updated.code,
        name: updated.name,
        isSystem: updated.isSystem,
        cloneFromCode: updated.cloneFromCode,
      };
    });
  }

  @Delete("roles/:code")
  deleteRole(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("code") code: string,
  ) {
    return withStaffTenant(req, session, async () => {
      assertPermission(session, PERMISSIONS.ACCESS_MANAGE);
      const role = await findOrgRoleByCodeWithUserCount(session.organizationId, code);
      if (!role) throw new NotFoundException({ error: "Role not found" });
      const deletable = canDeleteRole({
        isSystem: role.isSystem,
        code: role.code,
        userCount: role._count.users,
      });
      if (!deletable.ok) {
        if (deletable.reason === "system") {
          throw new BadRequestException({ error: "Cannot delete a system role" });
        }
        throw new ConflictException({
          error: "Role still has users",
          userCount: role._count.users,
        });
      }
      await deleteRoleById(role.id);
      await recordAudit(
        { userId: session.sub, request: expressKitHeaders(req) },
        "Role",
        role.id,
        "ROLE_DELETE",
        { code: role.code, name: role.name },
      );
      void publishSatelliteRole({
        organizationId: session.organizationId,
        satelliteKey: "industry_construction",
        code: role.code,
        name: role.name,
        active: false,
      });
      return { deleted: true, code: role.code };
    });
  }

  @Get("roles/:code/permissions")
  getPermissions(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("code") code: string,
  ) {
    return withStaffTenant(req, session, async () => {
      assertPermission(session, PERMISSIONS.ACCESS_MANAGE);
      const role = await findOrgRoleByCode(session.organizationId, code);
      if (!role) throw new NotFoundException({ error: "Role not found" });
      return {
        code: role.code,
        name: role.name,
        isSystem: role.isSystem,
        cloneFromCode: role.cloneFromCode,
        permissions: effectiveRolePermissions(role),
      };
    });
  }

  @Patch("roles/:code/permissions")
  patchPermissions(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("code") code: string,
    @Body() body: unknown,
  ) {
    return withStaffTenant(req, session, async () => {
      assertPermission(session, PERMISSIONS.ACCESS_MANAGE);
      const parsed = z
        .object({
          permissions: z.array(z.string()).optional(),
          resetToDefaults: z.boolean().optional(),
        })
        .parse(body);
      const role = await findOrgRoleByCode(session.organizationId, code);
      if (!role) throw new NotFoundException({ error: "Role not found" });

      let next: Permission[];
      if (parsed.resetToDefaults) {
        next = templatePermissionsForReset(role);
        if (next.length === 0 && !isSystemRoleCode(role.code)) {
          throw new BadRequestException({ error: "No defaults available for this role" });
        }
      } else if (parsed.permissions) {
        const invalid = parsed.permissions.filter((p) => !isPermission(p));
        if (invalid.length > 0) {
          throw new BadRequestException({ error: "Unknown permission codes", invalid });
        }
        next = parsed.permissions as Permission[];
      } else {
        throw new BadRequestException({ error: "permissions or resetToDefaults required" });
      }

      const before = effectiveRolePermissions(role);
      const updated = await updateRolePermissions(role.id, serializePermissions(next));
      await recordAudit(
        { userId: session.sub, request: expressKitHeaders(req) },
        "Role",
        role.id,
        "ROLE_PERMISSIONS_PATCH",
        {
          code: role.code,
          before,
          after: next,
          resetToDefaults: parsed.resetToDefaults === true,
        },
      );
      return { code: updated.code, permissions: parsePermissions(updated.permissionsJson) };
    });
  }

  @Get("users")
  listUsers(@Req() req: ConstructionRequest, @Staff() session: StaffSession) {
    return withStaffTenant(req, session, async () => {
      assertPermission(session, PERMISSIONS.ACCESS_MANAGE);
      const users = await listOrgUsers(session.organizationId);
      return users.map((u) => ({
        id: u.id,
        login: u.login,
        fullName: u.fullName,
        status: u.status,
        roleCode: u.role.code,
      }));
    });
  }

  @Patch("users")
  assignUserRole(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Body() body: unknown,
  ) {
    return withStaffTenant(req, session, async () => {
      assertPermission(session, PERMISSIONS.ACCESS_MANAGE);
      const parsed = z
        .object({
          userId: z.string().trim().min(1),
          roleCode: z.string().trim().min(1).max(64),
        })
        .parse(body);
      const roleCode = normalizeRoleCode(parsed.roleCode);
      const role = await findUserOrgRoleByCode(session.organizationId, roleCode);
      if (!role) throw new BadRequestException({ error: "Unknown role code" });
      const user = await findOrgUserWithRole(session.organizationId, parsed.userId);
      if (!user) throw new NotFoundException({ error: "User not found" });
      const denied = roleAssignDenied({
        actorBypass: hasPermissionBypass(session),
        fromRoleCode: user.role.code,
        toRoleCode: role.code,
      });
      if (denied) throw new ForbiddenException({ error: denied });
      await assignUserRole(user.id, role.id);
      await recordAudit(
        { userId: session.sub, request: expressKitHeaders(req) },
        "User",
        user.id,
        "USER_ROLE_ASSIGN",
        { before: user.role.code, after: role.code },
      );
      return { userId: user.id, roleCode: role.code };
    });
  }

  @Get("links")
  links(@Req() req: ConstructionRequest, @Staff() session: StaffSession) {
    return withStaffTenant(req, session, async () => {
      assertPermission(session, PERMISSIONS.SCREEN_ADMIN_SETTINGS);
      const channels = await fetchCpChannels();
      const mode = await resolveOperatingMode(requestOrganizationId()).catch(() => null);
      return { ...channels, operatingMode: mode };
    });
  }

  @Patch("links")
  patchLinks(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Body() body: unknown,
  ) {
    return withStaffTenant(req, session, async () => {
      assertPermission(session, PERMISSIONS.SCREEN_ADMIN_SETTINGS);
      const parsed = body as { channelId?: string; enabled?: boolean };
      if (!parsed.channelId || typeof parsed.enabled !== "boolean") {
        throw new BadRequestException({ error: "channelId and enabled required" });
      }
      const result = await patchCpChannel(parsed.channelId, parsed.enabled);
      if (!result.ok) {
        throw new HttpException(
          { error: "Channel update failed", status: result.status },
          result.status >= 400 ? result.status : 502,
        );
      }
      return { ok: true };
    });
  }
}
