/**
 * Orchestrator re-export of shared CP permission catalog (@era/contracts).
 * Donor UserRole typing stays local for Prisma Membership.role.
 */
import { UserRole } from "@era365/database";
import {
  donorRoleCodeForOrgRole,
  isSystemCpRoleCode,
} from "@era/contracts";

export {
  CP_PERMISSION,
  ALL_CP_PERMISSIONS,
  LOCKED_CP_PERMISSIONS,
  GRANTABLE_CP_PERMISSIONS,
  CP_PERMISSION_GROUPS,
  DEFAULT_CP_ROLE_PERMISSIONS,
  SYSTEM_CP_ROLE_CODES,
  SYSTEM_CP_ROLE_NAMES,
  CP_CUSTOM_ROLE_CODE_RE,
  isLockedCpPermission,
  isAuditorCpRole,
  auditorDisallowedPermissions,
  isCpPermission,
  isSystemCpRoleCode,
  isValidCustomCpRoleCode,
  permissionsJsonNeedsTemplate,
  parseCpRolePermissions,
  serializeCpRolePermissions,
  defaultPermissionsForCpRole,
  permissionsJsonForCpRole,
  effectiveCpRolePermissions,
  normalizeCpPermissionCode,
  sessionHasAnyCpPermission,
  LEGACY_CP_PERMISSION_ALIASES,
  type CpPermission,
  type CpPermissionGroup,
  type CpPermissionGroupId,
  type CpSystemRoleCode,
} from "@era/contracts";

export function donorUserRoleForOrgRole(input: {
  code: string;
  cloneFromCode: string | null;
}): UserRole {
  const code = donorRoleCodeForOrgRole(input);
  if (isSystemCpRoleCode(code)) return code as UserRole;
  return UserRole.USER;
}
