import { prisma } from "@/lib/prisma";

export function listUsersForOrganization(organizationId: string) {
  return prisma.user.findMany({
    where: { organizationId },
    orderBy: { login: "asc" },
    select: {
      id: true,
      login: true,
      fullName: true,
      status: true,
      role: { select: { code: true } },
    },
  });
}

export function findRoleByOrganizationAndCode(
  organizationId: string,
  roleCode: string,
) {
  return prisma.role.findFirst({ where: { organizationId, code: roleCode } });
}

export function findUserForRoleAssign(userId: string, organizationId: string) {
  return prisma.user.findFirst({
    where: { id: userId, organizationId },
    include: { role: { select: { code: true } } },
  });
}

export function assignUserRole(userId: string, roleId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { roleId },
  });
}
