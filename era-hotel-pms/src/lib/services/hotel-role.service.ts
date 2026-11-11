import { prisma } from '@/lib/prisma';
import {
  ensureSystemHotelRoles,
  HOTEL_PERMISSION_CATALOG_VERSION,
} from '@/lib/auth/ensure-system-hotel-roles';

export async function ensureHotelRolesForOrg(organizationId: string) {
  await ensureSystemHotelRoles(prisma, organizationId);
}

export async function listHotelRoles(organizationId: string) {
  return prisma.role.findMany({
    where: { organizationId },
    orderBy: [{ isSystem: 'desc' }, { code: 'asc' }],
    include: { _count: { select: { users: true } } },
  });
}

export async function findHotelRoleByCode(organizationId: string, code: string) {
  return prisma.role.findFirst({
    where: { organizationId, code },
  });
}

export async function findHotelRoleByCodeWithUserCount(organizationId: string, code: string) {
  return prisma.role.findFirst({
    where: { organizationId, code },
    include: { _count: { select: { users: true } } },
  });
}

export async function createHotelRole(input: {
  organizationId: string;
  code: string;
  name: string;
  cloneFromCode: string;
  permissionsJson: string;
}) {
  return prisma.role.create({
    data: {
      organizationId: input.organizationId,
      code: input.code,
      name: input.name,
      isSystem: false,
      cloneFromCode: input.cloneFromCode,
      permissionsJson: input.permissionsJson,
      permissionCatalogVersion: HOTEL_PERMISSION_CATALOG_VERSION,
    },
  });
}

export async function updateHotelRoleName(roleId: string, name: string) {
  return prisma.role.update({
    where: { id: roleId },
    data: { name },
  });
}

export async function deleteHotelRole(roleId: string) {
  return prisma.role.delete({ where: { id: roleId } });
}

export async function updateHotelRolePermissions(roleId: string, permissionsJson: string) {
  return prisma.role.update({
    where: { id: roleId },
    data: {
      permissionsJson,
      permissionCatalogVersion: HOTEL_PERMISSION_CATALOG_VERSION,
    },
  });
}
