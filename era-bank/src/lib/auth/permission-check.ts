import { isPlatformSuperAdminEdge } from "@/lib/auth/platform-super-admin-edge";
import {
  ALL_PERMISSIONS,
  coerceBankPermission,
  type Permission,
} from "@/lib/auth/permissions";

export type BankPermissionSession = {
  login: string;
  email?: string;
  role: string;
  permissions?: string[];
  isOwner?: boolean;
};

/**
 * Platform super-admin + OrgOwner (BUSINESS_OWNER / isOwner) bypass.
 * BRANCH_MANAGER does NOT bypass — matrix applies.
 */
export function hasBankPermissionBypass(session: BankPermissionSession): boolean {
  if (session.isOwner === true) return true;
  if (session.role === "BUSINESS_OWNER") return true;
  return isPlatformSuperAdminEdge({
    login: session.login,
    email: session.email,
  });
}

export function resolveSessionPermissions(
  session: BankPermissionSession,
): Permission[] {
  if (hasBankPermissionBypass(session)) {
    return [...ALL_PERMISSIONS];
  }
  if (!session.permissions?.length) return [];
  const out: Permission[] = [];
  const seen = new Set<string>();
  for (const raw of session.permissions) {
    const n = coerceBankPermission(String(raw));
    if (n && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

export function sessionHasBankPermission(
  session: BankPermissionSession,
  permission: Permission,
): boolean {
  if (hasBankPermissionBypass(session)) return true;
  return resolveSessionPermissions(session).includes(permission);
}
