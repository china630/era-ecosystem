import { isPlatformSuperAdminEdge } from "@/lib/auth/platform-super-admin-edge";
import {
  ALL_PERMISSIONS,
  coerceFnbPermission,
  type Permission,
} from "@/lib/auth/permissions";

export type FnbPermissionSession = {
  login: string;
  email?: string;
  role: string;
  permissions?: string[];
  isOwner?: boolean;
  /** PIN sessions never get owner bypass. */
  pin?: boolean;
};

/**
 * Platform super-admin + OrgOwner (BUSINESS_OWNER / isOwner) bypass.
 * FB_MANAGER does NOT bypass — matrix applies.
 * PIN sessions never bypass.
 */
export function hasFnbPermissionBypass(session: FnbPermissionSession): boolean {
  if (session.pin === true) return false;
  if (session.isOwner === true) return true;
  if (session.role === "BUSINESS_OWNER") return true;
  return isPlatformSuperAdminEdge({
    login: session.login,
    email: session.email,
  });
}

export function resolveSessionPermissions(
  session: FnbPermissionSession,
): Permission[] {
  if (hasFnbPermissionBypass(session)) {
    return [...ALL_PERMISSIONS];
  }
  if (!session.permissions?.length) return [];
  const out: Permission[] = [];
  const seen = new Set<string>();
  for (const raw of session.permissions) {
    const n = coerceFnbPermission(String(raw));
    if (n && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

export function sessionHasFnbPermission(
  session: FnbPermissionSession,
  permission: Permission,
): boolean {
  if (hasFnbPermissionBypass(session)) return true;
  return resolveSessionPermissions(session).includes(permission);
}
