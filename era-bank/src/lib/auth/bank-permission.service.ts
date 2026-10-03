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

/**
 * API grants for a staff session and its (active) OpsUser role: owner and
 * platform super-admin get all; others get their OpsRole grants.
 */
export function permissionsForSession(
  session: { login: string; email?: string; role: string; isOwner?: boolean },
  opsRole: { code: string; permissionsJson: string },
): Permission[] {
  if (
    hasBankPermissionBypass({
      login: session.login,
      email: session.email,
      role: session.role,
      isOwner: session.isOwner,
    })
  ) {
    return [...ALL_PERMISSIONS];
  }
  if (opsRole.code === "BUSINESS_OWNER") return [...ALL_PERMISSIONS];
  return effectiveRolePermissions(opsRole.code, opsRole.permissionsJson);
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
