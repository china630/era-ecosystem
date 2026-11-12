import { prisma } from "@/lib/prisma";
import { PERMISSION_CATALOG_VERSION, type Permission } from "@/lib/auth/permissions";
import { serializePermissions } from "@/lib/auth/permission-catalog";

export async function listOrgRolesWithUserCounts(organizationId: string) {
  return prisma.role.findMany({
    where: { organizationId },
    orderBy: [{ isSystem: "desc" }, { code: "asc" }],
    include: { _count: { select: { users: true } } },
  });
}

export async function findOrgRoleByCode(organizationId: string, code: string) {
  return prisma.role.findFirst({ where: { organizationId, code } });
}

export async function findOrgRoleByCodeWithUserCount(organizationId: string, code: string) {
  return prisma.role.findFirst({
    where: { organizationId, code },
    include: { _count: { select: { users: true } } },
  });
}

export type CreateCustomRoleInput = {
  organizationId: string;
  code: string;
  name: string;
  cloneFromCode: string;
  permissions: Permission[];
};

export async function createCustomRole(body: CreateCustomRoleInput) {
  return prisma.role.create({
    data: {
      organizationId: body.organizationId,
      code: body.code,
      name: body.name,
      isSystem: false,
      cloneFromCode: body.cloneFromCode,
      permissionsJson: serializePermissions(body.permissions),
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
  return prisma.role.delete({ where: { id: roleId } });
}

export async function updateRolePermissions(
  roleId: string,
  permissionsJson: string,
) {
  return prisma.role.update({
    where: { id: roleId },
    data: {
      permissionsJson,
      permissionCatalogVersion: PERMISSION_CATALOG_VERSION,
    },
  });
}
