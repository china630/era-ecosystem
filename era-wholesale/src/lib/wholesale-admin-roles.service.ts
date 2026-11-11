import { prisma } from "@/lib/prisma";

export function listRolesForOrganization(organizationId: string) {
  return prisma.role.findMany({
    where: { organizationId },
    orderBy: [{ isSystem: "desc" }, { code: "asc" }],
    include: { _count: { select: { users: true } } },
  });
}

export function findRoleByOrganizationAndCode(
  organizationId: string,
  code: string,
) {
  return prisma.role.findFirst({ where: { organizationId, code } });
}

export function findRoleByOrganizationAndCodeWithUserCount(
  organizationId: string,
  code: string,
) {
  return prisma.role.findFirst({
    where: { organizationId, code },
    include: { _count: { select: { users: true } } },
  });
}

export function createRoleFromDonor(data: {
  organizationId: string;
  code: string;
  name: string;
  cloneFromCode: string;
  permissionsJson: string;
  permissionCatalogVersion: number;
}) {
  return prisma.role.create({
    data: {
      organizationId: data.organizationId,
      code: data.code,
      name: data.name,
      isSystem: false,
      cloneFromCode: data.cloneFromCode,
      permissionsJson: data.permissionsJson,
      permissionCatalogVersion: data.permissionCatalogVersion,
    },
  });
}

export function updateRoleName(roleId: string, name: string) {
  return prisma.role.update({
    where: { id: roleId },
    data: { name },
  });
}

export function deleteRoleById(roleId: string) {
  return prisma.role.delete({ where: { id: roleId } });
}

export function updateRolePermissions(
  roleId: string,
  permissionsJson: string,
  permissionCatalogVersion: number,
) {
  return prisma.role.update({
    where: { id: roleId },
    data: {
      permissionsJson,
      permissionCatalogVersion,
    },
  });
}
