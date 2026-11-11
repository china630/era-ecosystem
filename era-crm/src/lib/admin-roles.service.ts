import { prisma } from "@/lib/prisma";
import {
  PERMISSION_CATALOG_VERSION,
  type Permission,
} from "@/lib/auth/permissions";
import {
  effectiveRolePermissions,
  serializePermissions,
} from "@/lib/auth/permission-catalog";

export async function listOrgRolesWithCounts(organizationId: string) {
  return prisma.role.findMany({
    where: { organizationId },
    orderBy: [{ isSystem: "desc" }, { code: "asc" }],
    include: { _count: { select: { users: true } } },
  });
}

export async function findOrgRoleByCode(organizationId: string, code: string) {
  return prisma.role.findFirst({ where: { organizationId, code } });
}

export async function findOrgRoleWithUserCount(
  organizationId: string,
  code: string,
) {
  return prisma.role.findFirst({
    where: { organizationId, code },
    include: { _count: { select: { users: true } } },
  });
}

export async function createOrgRoleFromDonor(opts: {
  organizationId: string;
  code: string;
  name: string;
  donorCode: string;
  permissions: Permission[];
}) {
  return prisma.role.create({
    data: {
      organizationId: opts.organizationId,
      code: opts.code,
      name: opts.name,
      isSystem: false,
      cloneFromCode: opts.donorCode,
      permissionsJson: serializePermissions(opts.permissions),
      permissionCatalogVersion: PERMISSION_CATALOG_VERSION,
    },
  });
}

export async function updateRoleName(roleId: string, name: string) {
  return prisma.role.update({
    where: { id: roleId },
    data: { name },
  });
}

export async function deleteRoleById(roleId: string) {
  await prisma.role.delete({ where: { id: roleId } });
}

export async function updateRolePermissions(
  roleId: string,
  permissions: Permission[],
) {
  return prisma.role.update({
    where: { id: roleId },
    data: {
      permissionsJson: serializePermissions(permissions),
      permissionCatalogVersion: PERMISSION_CATALOG_VERSION,
    },
  });
}

export function mapRoleListPayload(
  roles: Awaited<ReturnType<typeof listOrgRolesWithCounts>>,
) {
  return roles.map((role) => ({
    id: role.id,
    code: role.code,
    name: role.name,
    isSystem: role.isSystem,
    cloneFromCode: role.cloneFromCode,
    userCount: role._count.users,
    permissions: effectiveRolePermissions(role),
  }));
}
