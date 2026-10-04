import { isSystemRoleCode } from "@/lib/auth/permission-catalog";
import { OWNER_ROLE_CODE } from "@/lib/auth/permission-check";

export const CUSTOM_ROLE_CODE_RE = /^[A-Z][A-Z0-9_]{1,31}$/;

export function normalizeRoleCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isValidCustomRoleCode(code: string): boolean {
  return CUSTOM_ROLE_CODE_RE.test(code) && !isSystemRoleCode(code);
}

export function canMutateCustomRoleMeta(role: { isSystem: boolean }): boolean {
  return !role.isSystem;
}

export function canDeleteRole(input: {
  isSystem: boolean;
  code: string;
  userCount: number;
}): { ok: true } | { ok: false; reason: "system" | "in_use" } {
  if (input.isSystem || isSystemRoleCode(input.code)) return { ok: false, reason: "system" };
  if (input.userCount > 0) return { ok: false, reason: "in_use" };
  return { ok: true };
}

/**
 * Only an actor who already bypasses grants may hand out or take away the
 * owner package; otherwise the matrix admin could promote themselves past it.
 */
export function roleAssignDenied(input: {
  actorBypass: boolean;
  fromRoleCode: string;
  toRoleCode: string;
}): string | null {
  if (input.actorBypass) return null;
  if (input.toRoleCode === OWNER_ROLE_CODE || input.fromRoleCode === OWNER_ROLE_CODE) {
    return "Forbidden: only the business owner can assign the owner role";
  }
  return null;
}
