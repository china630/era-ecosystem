import { prisma } from "@/lib/prisma";
import { PERMISSION_CATALOG_VERSION } from "@/lib/auth/permissions";

export function listRolesForOrganization(organizationId: string) {
  return prisma.role.findMany({
    where: { organizationId },
    orderBy: [{ isSystem: "desc" }, { code: "asc" }],
    include: { _count: { select: { users: true } } },
  });
}

export function findRoleByCode(organizationId: string, code: string) {
  return prisma.role.findFirst({
    where: { organizationId, code },
  });
}

export function findRoleByCodeWithUserCount(organizationId: string, code: string) {
  return prisma.role.findFirst({
    where: { organizationId, code },
    include: { _count: { select: { users: true } } },
  });
}

export function createCustomRole(data: {
  organizationId: string;
  code: string;
  name: string;
  cloneFromCode: string;
  permissionsJson: string;
}) {
  return prisma.role.create({
    data: {
      organizationId: data.organizationId,
      code: data.code,
      name: data.name,
      isSystem: false,
      cloneFromCode: data.cloneFromCode,
      permissionsJson: data.permissionsJson,
      permissionCatalogVersion: PERMISSION_CATALOG_VERSION,
    },
  });
}

export function updateRoleName(roleId: string, name: string) {
  return prisma.role.update({
    where: { id: roleId },
    data: { name },
  });
}

export function deleteRole(roleId: string) {
  return prisma.role.delete({ where: { id: roleId } });
}

export function updateRolePermissionsJson(roleId: string, permissionsJson: string) {
  return prisma.role.update({
    where: { id: roleId },
    data: {
      permissionsJson,
      permissionCatalogVersion: PERMISSION_CATALOG_VERSION,
    },
  });
}

export function listWorkforceRoleCodes(organizationId: string) {
  return prisma.role.findMany({
    where: { organizationId },
    select: { code: true, name: true },
    orderBy: { code: "asc" },
  });
}
