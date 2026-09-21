import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ControlPlanePrismaService } from "../prisma/control-plane-prisma.service";
import {
  CP_CUSTOM_ROLE_CODE_RE,
  CP_PERMISSION_GROUPS,
  DEFAULT_CP_ROLE_PERMISSIONS,
  donorUserRoleForOrgRole,
  effectiveCpRolePermissions,
  isCpPermission,
  isLockedCpPermission,
  isSystemCpRoleCode,
  isValidCustomCpRoleCode,
  parseCpRolePermissions,
  permissionsJsonForCpRole,
  permissionsJsonNeedsTemplate,
  serializeCpRolePermissions,
  SYSTEM_CP_ROLE_NAMES,
  isAuditorCpRole,
  auditorDisallowedPermissions,
  type CpPermission,
} from "../auth/cp-permissions";
import { ensureSystemCpRoles } from "../auth/ensure-system-cp-roles";

@Injectable()
export class CpAccessService {
  constructor(private readonly prisma: ControlPlanePrismaService) {}

  catalog() {
    return {
      groups: CP_PERMISSION_GROUPS,
      locked: CP_PERMISSION_GROUPS.flatMap((g) =>
        g.permissions.filter(isLockedCpPermission),
      ),
      auditorAllowlist: [...DEFAULT_CP_ROLE_PERMISSIONS.AUDITOR],
    };
  }

  async listRoles(organizationId: string) {
    await ensureSystemCpRoles(this.prisma, organizationId);
    const roles = await this.prisma.organizationRole.findMany({
      where: { organizationId },
      orderBy: [{ isSystem: "desc" }, { code: "asc" }],
      include: { _count: { select: { memberships: true } } },
    });
    return roles.map((role) => {
      const permissions = effectiveCpRolePermissions(
        role.code,
        role.permissionsJson,
      );
      return {
        id: role.id,
        code: role.code,
        name: role.name,
        isSystem: role.isSystem,
        cloneFromCode: role.cloneFromCode,
        permissionCount: permissions.length,
        permissions,
        userCount: role._count.memberships,
        customized: this.isCustomized(role.code, role.permissionsJson),
      };
    });
  }

  private isCustomized(code: string, permissionsJson: string): boolean {
    if (permissionsJsonNeedsTemplate(permissionsJson)) return false;
    const stored = serializeCpRolePermissions(
      parseCpRolePermissions(permissionsJson),
    );
    if (stored === "[]") return true;
    return stored !== permissionsJsonForCpRole(code);
  }

  async getRolePermissions(organizationId: string, code: string) {
    await ensureSystemCpRoles(this.prisma, organizationId);
    const role = await this.prisma.organizationRole.findFirst({
      where: { organizationId, code },
    });
    if (!role) throw new NotFoundException("Role not found");
    return {
      code: role.code,
      name: role.name,
      isSystem: role.isSystem,
      cloneFromCode: role.cloneFromCode,
      permissions: effectiveCpRolePermissions(role.code, role.permissionsJson),
      customized: this.isCustomized(role.code, role.permissionsJson),
    };
  }

  async patchRolePermissions(
    organizationId: string,
    code: string,
    body: {
      permissions?: string[];
      resetToDefaults?: boolean;
    },
  ) {
    await ensureSystemCpRoles(this.prisma, organizationId);
    const role = await this.prisma.organizationRole.findFirst({
      where: { organizationId, code },
    });
    if (!role) throw new NotFoundException("Role not found");

    let next: CpPermission[];
    if (body.resetToDefaults) {
      if (isSystemCpRoleCode(code)) {
        next = [...DEFAULT_CP_ROLE_PERMISSIONS[code]];
      } else if (role.cloneFromCode) {
        const donor = await this.prisma.organizationRole.findFirst({
          where: { organizationId, code: role.cloneFromCode },
        });
        if (!donor) {
          throw new BadRequestException("cloneFrom role missing; cannot reset");
        }
        next = effectiveCpRolePermissions(donor.code, donor.permissionsJson);
      } else {
        throw new BadRequestException("No defaults available for this role");
      }
    } else if (body.permissions) {
      const invalid = body.permissions.filter((p) => !isCpPermission(p));
      if (invalid.length) {
        throw new BadRequestException(`Unknown permissions: ${invalid.join(",")}`);
      }
      const locked = body.permissions.filter(isLockedCpPermission);
      if (locked.length) {
        throw new BadRequestException(
          `Locked permissions cannot be granted: ${locked.join(",")}`,
        );
      }
      next = body.permissions as CpPermission[];
      if (isAuditorCpRole(code, role.cloneFromCode)) {
        const bad = auditorDisallowedPermissions(next);
        if (bad.length) {
          throw new BadRequestException(
            `Auditor is read-only; cannot grant: ${bad.join(",")}`,
          );
        }
      }
    } else {
      throw new BadRequestException("permissions or resetToDefaults required");
    }

    await this.prisma.organizationRole.update({
      where: { id: role.id },
      data: { permissionsJson: serializeCpRolePermissions(next) },
    });

    return {
      code: role.code,
      permissions: next,
      customized: true,
    };
  }

  async cloneRole(
    organizationId: string,
    input: { code: string; name: string; cloneFrom: string },
  ) {
    await ensureSystemCpRoles(this.prisma, organizationId);
    const code = input.code.trim().toUpperCase();
    if (!isValidCustomCpRoleCode(code)) {
      throw new BadRequestException(
        `Invalid custom role code (must match ${CP_CUSTOM_ROLE_CODE_RE} and not be a system enum)`,
      );
    }
    const donor = await this.prisma.organizationRole.findFirst({
      where: { organizationId, code: input.cloneFrom },
    });
    if (!donor) throw new NotFoundException("cloneFrom role not found");

    const existing = await this.prisma.organizationRole.findFirst({
      where: { organizationId, code },
    });
    if (existing) throw new ConflictException("Role code already exists");

    const permissions = effectiveCpRolePermissions(
      donor.code,
      donor.permissionsJson,
    ).filter((p) => !isLockedCpPermission(p));

    const created = await this.prisma.organizationRole.create({
      data: {
        organizationId,
        code,
        name: input.name.trim() || code,
        isSystem: false,
        cloneFromCode: donor.code,
        permissionsJson: serializeCpRolePermissions(permissions),
      },
    });

    return {
      id: created.id,
      code: created.code,
      name: created.name,
      isSystem: false,
      cloneFromCode: created.cloneFromCode,
      permissions,
      donorRole: donorUserRoleForOrgRole({
        code: created.code,
        cloneFromCode: created.cloneFromCode,
      }),
    };
  }

  async deleteRole(organizationId: string, code: string) {
    if (isSystemCpRoleCode(code)) {
      throw new BadRequestException("Cannot delete system roles");
    }
    const role = await this.prisma.organizationRole.findFirst({
      where: { organizationId, code },
      include: { _count: { select: { memberships: true } } },
    });
    if (!role) throw new NotFoundException("Role not found");
    if (role._count.memberships > 0) {
      throw new ConflictException("Role still has memberships");
    }
    await this.prisma.organizationRole.delete({ where: { id: role.id } });
    return { ok: true };
  }

  systemRoleLabels() {
    return SYSTEM_CP_ROLE_NAMES;
  }
}
