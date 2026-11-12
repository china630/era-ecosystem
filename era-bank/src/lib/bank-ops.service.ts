import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureSystemBankRoles } from "@/lib/auth/ensure-system-bank-roles";

export function findOpsUserForLogin(organizationId: string, username: string) {
  return prisma.opsUser.findFirst({
    where: { organizationId, username },
    include: { opsRole: true },
  });
}

export function findOpsRoleById(id: string) {
  return prisma.opsRole.findUniqueOrThrow({ where: { id } });
}

export function createOpsSession(data: { opsUserId: string; branchId: string }) {
  return prisma.opsSession.create({ data });
}

export function findOpsUserWithRole(id: string) {
  return prisma.opsUser.findUnique({
    where: { id },
    include: { opsRole: true },
  });
}

export function findOpsRoleByCode(organizationId: string, code: string) {
  return prisma.opsRole.findFirst({ where: { organizationId, code } });
}

export function listOpsActionLogs() {
  return prisma.opsActionLog.findMany({
    orderBy: { at: "desc" },
    take: 100,
    include: {
      opsUser: { select: { username: true, fullName: true } },
    },
  });
}

export function listWorkforceRoleCodes(organizationId: string) {
  return prisma.opsRole.findMany({
    where: { organizationId },
    select: { code: true, name: true },
    orderBy: { code: "asc" },
  });
}

export function listOpsUsers(organizationId: string) {
  return prisma.opsUser.findMany({
    where: { organizationId },
    orderBy: { username: "asc" },
    include: { opsRole: { select: { code: true, name: true } } },
  });
}

export function findOpsUserInOrg(id: string, organizationId: string) {
  return prisma.opsUser.findFirst({ where: { id, organizationId } });
}

export function assignOpsUserRole(id: string, opsRoleId: string) {
  return prisma.opsUser.update({
    where: { id },
    data: { opsRoleId },
    include: { opsRole: { select: { code: true, name: true } } },
  });
}

export function listOpsRoles(organizationId: string) {
  return prisma.opsRole.findMany({
    where: { organizationId },
    orderBy: [{ isSystem: "desc" }, { code: "asc" }],
    include: { _count: { select: { users: true } } },
  });
}

export function createOpsRole(data: Prisma.OpsRoleUncheckedCreateInput) {
  return prisma.opsRole.create({ data });
}

export function updateOpsRoleName(id: string, name: string) {
  return prisma.opsRole.update({ where: { id }, data: { name } });
}

export function findOpsRoleWithUserCount(organizationId: string, code: string) {
  return prisma.opsRole.findFirst({
    where: { organizationId, code },
    include: { _count: { select: { users: true } } },
  });
}

export function deleteOpsRole(id: string) {
  return prisma.opsRole.delete({ where: { id } });
}

export function updateOpsRolePermissions(
  id: string,
  permissionsJson: string,
  permissionCatalogVersion: number,
) {
  return prisma.opsRole.update({
    where: { id },
    data: { permissionsJson, permissionCatalogVersion },
  });
}

export async function provisionSsoOpsUser(input: {
  organizationId: string;
  satelliteRole: string;
  roleName: string;
  permissionsJson: string;
  permissionCatalogVersion: number;
  username: string;
  fullName: string;
  branchId: string;
}) {
  const existingRole = await prisma.opsRole.findFirst({
    where: { organizationId: input.organizationId, code: input.satelliteRole },
  });
  const role =
    existingRole ??
    (await prisma.opsRole.create({
      data: {
        organizationId: input.organizationId,
        code: input.satelliteRole,
        name: input.roleName,
        isSystem: true,
        limitsJson: {},
        permissionsJson: input.permissionsJson,
        permissionCatalogVersion: input.permissionCatalogVersion,
      },
    }));
  if (existingRole && existingRole.name !== input.roleName) {
    await prisma.opsRole.update({
      where: { id: existingRole.id },
      data: { name: input.roleName, isSystem: true },
    });
  }
  await ensureSystemBankRoles(prisma, input.organizationId);
  const roleFresh = await prisma.opsRole.findUniqueOrThrow({ where: { id: role.id } });
  const user = await prisma.opsUser.upsert({
    where: {
      organizationId_username: {
        organizationId: input.organizationId,
        username: input.username,
      },
    },
    update: {
      fullName: input.fullName,
      passwordHash: "sso:no-password",
      branchId: input.branchId,
      opsRoleId: roleFresh.id,
      status: "ACTIVE",
    },
    create: {
      organizationId: input.organizationId,
      username: input.username,
      fullName: input.fullName,
      passwordHash: "sso:no-password",
      branchId: input.branchId,
      opsRoleId: roleFresh.id,
      status: "ACTIVE",
    },
    include: { opsRole: true },
  });
  return user;
}
