import { isPlatformSuperAdminEdge } from "@/lib/auth/platform-super-admin-edge";
import { ALL_PERMISSIONS, type Permission } from "@/lib/auth/permissions";
import { isPermission } from "@/lib/auth/permission-catalog";

export const OWNER_ROLE_CODE = "BUSINESS_OWNER";

export type PermissionSession = {
  login: string;
  email?: string | null;
  role: string;
  permissions?: readonly string[];
  isOwner?: boolean;
  pin?: boolean;
};

/** Platform super-admin and OrgOwner only. The access-manager role does not bypass. */
export function hasPermissionBypass(session: PermissionSession | null | undefined): boolean {
  if (!session || session.pin === true) return false;
  if (session.isOwner === true || session.role === OWNER_ROLE_CODE) return true;
  return isPlatformSuperAdminEdge({ login: session.login, email: session.email });
}

/** A missing `permissions` claim is an empty list (fail-closed). */
export function resolveSessionPermissions(
  session: PermissionSession | null | undefined,
): Permission[] {
  if (!session) return [];
  if (hasPermissionBypass(session)) return [...ALL_PERMISSIONS];
  return (session.permissions ?? []).filter(isPermission);
}

export function sessionHasPermission(
  session: PermissionSession | null | undefined,
  permission: Permission,
): boolean {
  if (!session) return false;
  if (hasPermissionBypass(session)) return true;
  return (session.permissions ?? []).includes(permission);
}

export function sessionHasAnyPermission(
  session: PermissionSession | null | undefined,
  permissions: readonly Permission[],
): boolean {
  return permissions.some((p) => sessionHasPermission(session, p));
}
