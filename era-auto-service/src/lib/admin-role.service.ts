import { prisma } from "@/lib/prisma";
import type { Permission } from "@/lib/auth/permissions";
import { PERMISSION_CATALOG_VERSION } from "@/lib/auth/permissions";
import { serializePermissions } from "@/lib/auth/permission-catalog";

export async function listOrganizationRoles(organizationId: string) {
  return prisma.role.findMany({
    where: { organizationId },
    orderBy: [{ isSystem: "desc" }, { code: "asc" }],
    include: { _count: { select: { users: true } } },
  });
}

export async function findOrganizationRoleByCode(organizationId: string, code: string) {
  return prisma.role.findFirst({ where: { organizationId, code } });
}

export async function findOrganizationRoleByCodeWithUserCount(organizationId: string, code: string) {
  return prisma.role.findFirst({
    where: { organizationId, code },
    include: { _count: { select: { users: true } } },
  });
}

export async function createOrganizationRole(data: {
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

export async function updateOrganizationRoleName(roleId: string, name: string) {
  return prisma.role.update({
    where: { id: roleId },
    data: { name },
  });
}

export async function deleteOrganizationRole(roleId: string) {
  await prisma.role.delete({ where: { id: roleId } });
}

export async function updateOrganizationRolePermissions(roleId: string, permissions: Permission[]) {
  return prisma.role.update({
    where: { id: roleId },
    data: {
      permissionsJson: serializePermissions(permissions),
      permissionCatalogVersion: PERMISSION_CATALOG_VERSION,
    },
  });
}
