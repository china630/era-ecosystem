import { prisma } from "@/lib/prisma";
import { ALL_PERMISSIONS, type Permission } from "@/lib/auth/permissions";
import { effectiveRolePermissions, type RoleGrantRow } from "@/lib/auth/permission-catalog";
import { hasPermissionBypass, OWNER_ROLE_CODE } from "@/lib/auth/permission-check";

export const ROLE_GRANT_SELECT = {
  code: true,
  permissionsJson: true,
  permissionCatalogVersion: true,
} as const;

export type GrantSubject = {
  login: string;
  email?: string | null;
  role: RoleGrantRow | null | undefined;
  isOwner?: boolean;
  pin?: boolean;
};

/** Grants from the role row. Owner and platform super-admin get the whole catalog. */
export function grantsForUser(subject: GrantSubject): Permission[] {
  const code = subject.role?.code ?? "";
  if (
    hasPermissionBypass({
      login: subject.login,
      email: subject.email,
      role: code,
      isOwner: subject.isOwner === true || code === OWNER_ROLE_CODE,
      pin: subject.pin,
    })
  ) {
    return [...ALL_PERMISSIONS];
  }
  return subject.role ? effectiveRolePermissions(subject.role) : [];
}

export async function permissionsForUserId(
  userId: string,
  opts: { isOwner?: boolean } = {},
): Promise<Permission[] | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { login: true, email: true, role: { select: ROLE_GRANT_SELECT } },
  });
  if (!user) return null;
  return grantsForUser({ ...user, isOwner: opts.isOwner });
}
