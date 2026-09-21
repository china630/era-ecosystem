import { UserRole } from "@era365/database";
import {
  ALL_CP_PERMISSIONS,
  defaultPermissionsForCpRole,
  type CpPermission,
} from "./cp-permissions";

/**
 * @deprecated Legacy finance-era codes — Wave 4 JWT uses api:/screen:/admin: only.
 * Kept as thin adapter for any residual callers; prefer cp-permissions templates.
 */
export const ALL_PERMISSION_CODES = ALL_CP_PERMISSIONS;

/** Seed / fallback — delegates to Wave 4 catalog templates. */
export function resolvePermissionsForRole(
  role: UserRole | null,
  opts?: { isSuperAdmin?: boolean },
): string[] {
  if (opts?.isSuperAdmin) return [...ALL_CP_PERMISSIONS];
  if (!role) return [];
  return defaultPermissionsForCpRole(role) as CpPermission[];
}
