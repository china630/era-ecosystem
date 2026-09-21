/**
 * Custom bank role codes: UPPER_SNAKE, not a reserved system code.
 */
import { isSystemBankRoleCode } from "@/lib/auth/permissions";

export const BANK_CUSTOM_ROLE_CODE_RE = /^[A-Z][A-Z0-9_]{1,31}$/;

export function normalizeBankRoleCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s-]+/g, "_");
}

export function isValidCustomBankRoleCode(code: string): boolean {
  if (!BANK_CUSTOM_ROLE_CODE_RE.test(code)) return false;
  if (isSystemBankRoleCode(code)) return false;
  return true;
}

export function canMutateCustomRoleMeta(role: { isSystem: boolean }): boolean {
  return !role.isSystem;
}

export function canDeleteBankRole(role: {
  isSystem: boolean;
  code: string;
  userCount: number;
}): { ok: true } | { ok: false; reason: "system" | "in_use" } {
  if (role.isSystem || isSystemBankRoleCode(role.code)) {
    return { ok: false, reason: "system" };
  }
  if (role.userCount > 0) {
    return { ok: false, reason: "in_use" };
  }
  return { ok: true };
}
