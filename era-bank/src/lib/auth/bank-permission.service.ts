import { prisma } from "@/lib/prisma";
import {
  ALL_PERMISSIONS,
  effectiveRolePermissions,
  type Permission,
} from "@/lib/auth/permissions";
import { ensureSystemBankRoles } from "@/lib/auth/ensure-system-bank-roles";
import { hasBankPermissionBypass } from "@/lib/auth/permission-check";

export async function permissionsForRoleCode(
  organizationId: string,
  roleCode: string,
): Promise<Permission[]> {
  await ensureSystemBankRoles(prisma, organizationId);
  const role = await prisma.opsRole.findFirst({
    where: { organizationId, code: roleCode },
  });
  if (!role) return [];
  return effectiveRolePermissions(role.code, role.permissionsJson);
}

export async function permissionsForUserId(
  userId: string,
): Promise<Permission[]> {
  const user = await prisma.opsUser.findUnique({
    where: { id: userId },
    include: { opsRole: true },
  });
  if (!user) return [];
  await ensureSystemBankRoles(prisma, user.organizationId);
  const role = await prisma.opsRole.findUnique({
    where: { id: user.opsRoleId },
  });
  if (!role) return [];
  const bypass = hasBankPermissionBypass({
    login: user.username,
    role: role.code,
    isOwner: role.code === "BUSINESS_OWNER",
  });
  if (bypass) return [...ALL_PERMISSIONS];
  return effectiveRolePermissions(role.code, role.permissionsJson);
}

export async function resolveSessionGrantList(input: {
  organizationId: string;
  userId: string;
  login: string;
  email?: string;
  role: string;
  isOwner?: boolean;
}): Promise<Permission[]> {
  await ensureSystemBankRoles(prisma, input.organizationId);
  const bypass = hasBankPermissionBypass({
    login: input.login,
    email: input.email,
    role: input.role,
    isOwner: input.isOwner,
  });
  if (bypass) return [...ALL_PERMISSIONS];
  return permissionsForUserId(input.userId);
}
