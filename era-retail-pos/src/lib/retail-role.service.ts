import { PERMISSION_CATALOG_VERSION, type Permission } from "@/lib/auth/permissions";
import { serializePermissions } from "@/lib/auth/permission-catalog";
import { prisma } from "@/lib/prisma";

export async function listRolesWithUserCounts(organizationId: string) {
  return prisma.role.findMany({
    where: { organizationId },
    orderBy: [{ isSystem: "desc" }, { code: "asc" }],
    include: { _count: { select: { users: true } } },
  });
}

export async function findRoleByOrgAndCode(organizationId: string, code: string) {
  return prisma.role.findFirst({ where: { organizationId, code } });
}

export async function findDonorRole(organizationId: string, cloneFromCode: string) {
  return prisma.role.findFirst({
    where: { organizationId, code: cloneFromCode },
  });
}

export async function createCustomRole(data: {
  organizationId: string;
  code: string;
  name: string;
  cloneFromCode: string;
  permissions: Permission[];
}) {
  return prisma.role.create({
    data: {
      organizationId: data.organizationId,
      code: data.code,
      name: data.name,
      isSystem: false,
      cloneFromCode: data.cloneFromCode,
      permissionsJson: serializePermissions(data.permissions),
      permissionCatalogVersion: PERMISSION_CATALOG_VERSION,
    },
  });
}

export async function renameCustomRole(roleId: string, name: string) {
  return prisma.role.update({
    where: { id: roleId },
    data: { name },
  });
}

export async function getRoleWithUserCount(organizationId: string, code: string) {
  return prisma.role.findFirst({
    where: { organizationId, code },
    include: { _count: { select: { users: true } } },
  });
}

export async function deleteRoleById(roleId: string) {
  return prisma.role.delete({ where: { id: roleId } });
}

export async function updateRolePermissions(roleId: string, permissions: Permission[]) {
  return prisma.role.update({
    where: { id: roleId },
    data: {
      permissionsJson: serializePermissions(permissions),
      permissionCatalogVersion: PERMISSION_CATALOG_VERSION,
    },
  });
}
