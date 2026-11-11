import { CLINIC_PERMISSION_CATALOG_VERSION } from "@/lib/auth/clinic-permissions";
import type { ClinicRoleStaffKind } from "@/lib/clinic-roles";
import { prisma } from "@/lib/prisma";
export async function listOrgStaffUsers(organizationId: string) {
  return prisma.user.findMany({
    where: { organizationId },
    orderBy: [{ fullName: "asc" }, { login: "asc" }],
    select: {
      id: true,
      login: true,
      fullName: true,
      email: true,
      status: true,
      isCrossSystem: true,
      role: {
        select: {
          code: true,
          name: true,
          isSystem: true,
          staffKind: true,
        },
      },
    },
  });
}

export async function findOrgUserWithRole(organizationId: string, userId: string) {
  return prisma.user.findFirst({
    where: { id: userId, organizationId },
    include: { role: true },
  });
}

export async function findOrgRoleByCode(organizationId: string, code: string) {
  return prisma.role.findFirst({
    where: { organizationId, code },
  });
}

export async function assignUserRole(userId: string, roleId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { roleId },
    include: { role: true },
  });
}

export async function listOrgRolesWithUserCounts(organizationId: string) {
  return prisma.role.findMany({
    where: { organizationId },
    orderBy: [{ isSystem: "desc" }, { code: "asc" }],
    include: { _count: { select: { users: true } } },
  });
}

export async function createOrgRole(data: {
  organizationId: string;
  code: string;
  name: string;
  staffKind: ClinicRoleStaffKind;
  cloneFromCode: string;
  permissionsJson: string;
}) {
  return prisma.role.create({
    data: {
      organizationId: data.organizationId,
      code: data.code,
      name: data.name,
      isSystem: false,
      staffKind: data.staffKind,
      cloneFromCode: data.cloneFromCode,
      permissionsJson: data.permissionsJson,
      permissionCatalogVersion: CLINIC_PERMISSION_CATALOG_VERSION,
    },
  });
}

export async function findOrgRoleForAdmin(organizationId: string, code: string) {
  return prisma.role.findFirst({
    where: { organizationId, code },
  });
}

export async function findOrgRoleWithUserCount(organizationId: string, code: string) {
  return prisma.role.findFirst({
    where: { organizationId, code },
    include: { _count: { select: { users: true } } },
  });
}

export async function updateOrgRoleMeta(
  roleId: string,
  data: { name?: string; staffKind?: ClinicRoleStaffKind },
) {
  return prisma.role.update({
    where: { id: roleId },
    data,
  });
}

export async function deleteOrgRole(roleId: string) {
  return prisma.role.delete({ where: { id: roleId } });
}

export async function updateOrgRolePermissions(roleId: string, permissionsJson: string) {
  return prisma.role.update({
    where: { id: roleId },
    data: { permissionsJson },
  });
}

export async function listWorkforceOrgRoles(organizationId: string) {
  return prisma.role.findMany({
    where: { organizationId },
    select: { code: true, name: true },
    orderBy: { code: "asc" },
  });
}
