import {
  hasClinicPermissionBypass,
  type ClinicAdminSession,
} from "@/lib/auth/clinic-admin-access";
import {
  ALL_CLINIC_PERMISSIONS,
  defaultPermissionsForRole,
  type ClinicPermission,
} from "@/lib/auth/clinic-permissions";

export { hasClinicPermissionBypass };

/** Edge-safe — no Prisma. Used by middleware and API. */
export function resolveSessionPermissions(
  session: Pick<ClinicAdminSession, "role" | "roles"> & { permissions?: string[] },
): ClinicPermission[] {
  if (session.permissions?.length) {
    return session.permissions.filter(
      (p): p is ClinicPermission =>
        ALL_CLINIC_PERMISSIONS.includes(p as ClinicPermission),
    );
  }
  return defaultPermissionsForRole(session.role);
}

/**
 * CLINIC_ADMIN does not bypass — matrix applies.
 * OrgOwner + platform super-admin still bypass.
 */
export function sessionHasClinicPermission(
  session: ClinicAdminSession & { permissions?: string[] },
  permission: ClinicPermission,
): boolean {
  if (hasClinicPermissionBypass(session)) return true;
  return resolveSessionPermissions(session).includes(permission);
}
