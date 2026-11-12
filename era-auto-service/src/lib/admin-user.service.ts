import { prisma } from "@/lib/prisma";

export async function listOrganizationUsers(organizationId: string) {
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

export async function findOrganizationRoleByCode(organizationId: string, roleCode: string) {
  return prisma.role.findFirst({ where: { organizationId, code: roleCode } });
}

export async function findOrganizationUserWithRole(organizationId: string, userId: string) {
  return prisma.user.findFirst({
    where: { id: userId, organizationId },
    include: { role: { select: { code: true } } },
  });
}

export async function assignUserRole(userId: string, roleId: string) {
  await prisma.user.update({ where: { id: userId }, data: { roleId } });
}
