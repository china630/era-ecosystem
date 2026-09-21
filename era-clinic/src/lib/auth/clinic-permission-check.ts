import {
  hasClinicPermissionBypass,
  type ClinicAdminSession,
} from "@/lib/auth/clinic-admin-access";
import {
  isClinicPermission,
  type ClinicPermission,
} from "@/lib/auth/clinic-permissions";

export { hasClinicPermissionBypass };

/**
 * Edge-safe — no Prisma. Used by middleware and API.
 * Array (incl. empty) is SoT — never fall back to role-name template.
 * Missing/undefined permissions → fail-closed [].
 */
export function resolveSessionPermissions(
  session: Pick<ClinicAdminSession, "role" | "roles"> & {
    permissions?: string[];
  },
): ClinicPermission[] {
  if (Array.isArray(session.permissions)) {
    return session.permissions.filter(isClinicPermission);
  }
  return [];
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

/** Any-of page gates (print forms, etc.). */
export function sessionHasAnyClinicPermission(
  session: ClinicAdminSession & { permissions?: string[] },
  permissions: ClinicPermission[],
): boolean {
  if (!permissions.length) return false;
  return permissions.some((p) => sessionHasClinicPermission(session, p));
}
