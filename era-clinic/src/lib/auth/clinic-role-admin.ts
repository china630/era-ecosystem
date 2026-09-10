import {
  isSystemClinicRoleCode,
  type ClinicRoleStaffKind,
} from "@/lib/clinic-roles";

export const CLINIC_CUSTOM_ROLE_CODE_RE = /^[A-Z][A-Z0-9_]{1,31}$/;

export function normalizeClinicRoleCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isValidCustomClinicRoleCode(code: string): boolean {
  return CLINIC_CUSTOM_ROLE_CODE_RE.test(code) && !isSystemClinicRoleCode(code);
}

export function canMutateCustomRoleMeta(role: {
  isSystem: boolean;
  code: string;
}): boolean {
  return !role.isSystem && !isSystemClinicRoleCode(role.code);
}

export function canDeleteClinicRole(role: {
  isSystem: boolean;
  code: string;
  userCount: number;
}): { ok: true } | { ok: false; reason: "system" | "has_users" } {
  if (role.isSystem || isSystemClinicRoleCode(role.code)) {
    return { ok: false, reason: "system" };
  }
  if (role.userCount > 0) return { ok: false, reason: "has_users" };
  return { ok: true };
}

export function parseAssignableStaffKind(
  value: string,
): ClinicRoleStaffKind | null {
  if (
    value === "DOCTOR" ||
    value === "NURSE" ||
    value === "LAB" ||
    value === "NONE"
  ) {
    return value;
  }
  return null;
}
