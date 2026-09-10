import { isSystemHotelRoleCode } from "@/lib/hotel-roles";

export const HOTEL_CUSTOM_ROLE_CODE_RE = /^[A-Z][A-Z0-9_]{1,31}$/;

export function normalizeHotelRoleCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isValidCustomHotelRoleCode(code: string): boolean {
  return HOTEL_CUSTOM_ROLE_CODE_RE.test(code) && !isSystemHotelRoleCode(code);
}

export function canMutateCustomRoleMeta(role: {
  isSystem: boolean;
  code: string;
}): boolean {
  return !role.isSystem && !isSystemHotelRoleCode(role.code);
}

export function canDeleteHotelRole(role: {
  isSystem: boolean;
  code: string;
  userCount: number;
}): { ok: true } | { ok: false; reason: "system" | "has_users" } {
  if (role.isSystem || isSystemHotelRoleCode(role.code)) {
    return { ok: false, reason: "system" };
  }
  if (role.userCount > 0) return { ok: false, reason: "has_users" };
  return { ok: true };
}
