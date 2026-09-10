import { isPlatformSuperAdminEdge } from "@/lib/auth/platform-super-admin-edge";
import {
  ALL_PERMISSIONS,
  isHotelPermission,
  type Permission,
} from "@/lib/auth/permissions";

export type HotelPermissionSession = {
  login: string;
  email?: string;
  role: string;
  permissions?: string[];
  isOwner?: boolean;
};

/**
 * Platform super-admin + OrgOwner (BUSINESS_OWNER / isOwner) bypass.
 * Hotel_Admin does NOT bypass — matrix applies.
 * Edge-safe (no Prisma / no @era/satellite-kit barrel).
 */
export function hasHotelPermissionBypass(
  session: HotelPermissionSession,
): boolean {
  if (session.isOwner === true) return true;
  if (session.role === "BUSINESS_OWNER") return true;
  return isPlatformSuperAdminEdge({
    login: session.login,
    email: session.email,
  });
}

export function resolveSessionPermissions(
  session: HotelPermissionSession,
): Permission[] {
  if (hasHotelPermissionBypass(session)) {
    return [...ALL_PERMISSIONS];
  }
  if (session.permissions?.length) {
    return session.permissions.filter(isHotelPermission);
  }
  return [];
}

export function sessionHasHotelPermission(
  session: HotelPermissionSession,
  permission: Permission,
): boolean {
  if (hasHotelPermissionBypass(session)) return true;
  return resolveSessionPermissions(session).includes(permission);
}
