import { hashPassword } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";

export async function listUsersForOrganization(organizationId: string) {
  return prisma.user.findMany({
    where: { organizationId },
    orderBy: { login: "asc" },
    select: {
      id: true,
      login: true,
      fullName: true,
      status: true,
      isCrossSystem: true,
      cpEmploymentId: true,
      positionTitle: true,
      role: { select: { code: true, name: true } },
    },
  });
}

export async function findRoleByCode(organizationId: string, roleCode: string) {
  return prisma.role.findFirst({ where: { organizationId, code: roleCode } });
}

export async function findUserWithRole(organizationId: string, userId: string) {
  return prisma.user.findFirst({
    where: { id: userId, organizationId },
    include: { role: { select: { code: true } } },
  });
}

export async function updateUserAdmin(
  userId: string,
  data: {
    roleId?: string;
    status?: "ACTIVE" | "DISABLED";
    fullName?: string;
  },
) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.roleId ? { roleId: data.roleId } : {}),
      ...(data.status ? { status: data.status } : {}),
      ...(data.fullName ? { fullName: data.fullName } : {}),
    },
  });
}

export async function findUserByLogin(organizationId: string, login: string) {
  return prisma.user.findFirst({
    where: { organizationId, login },
    select: { id: true },
  });
}

export async function createLocalUser(data: {
  organizationId: string;
  login: string;
  fullName: string;
  password: string;
  roleId: string;
}) {
  const passwordHash = await hashPassword(data.password);
  return prisma.user.create({
    data: {
      organizationId: data.organizationId,
      login: data.login,
      fullName: data.fullName,
      passwordHash,
      roleId: data.roleId,
      status: "ACTIVE",
    },
  });
}

export async function listUserLogins(input: {
  organizationId: string;
  q: string;
  from: string;
  to: string;
}) {
  return prisma.userLogin.findMany({
    where: {
      organizationId: input.organizationId,
      ...(input.q
        ? {
            OR: [
              { login: { contains: input.q, mode: "insensitive" } },
              { user: { fullName: { contains: input.q, mode: "insensitive" } } },
            ],
          }
        : {}),
      ...(input.from || input.to
        ? {
            createdAt: {
              ...(input.from ? { gte: new Date(`${input.from}T00:00:00.000Z`) } : {}),
              ...(input.to ? { lte: new Date(`${input.to}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { select: { fullName: true, login: true } } },
  });
}
