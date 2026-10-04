import {
  ALL_PERMISSIONS,
  LEGACY_FALLBACK_ROLE,
  ROLE_ALIASES,
  ROLE_TEMPLATES,
  SYSTEM_ROLE_CODES,
  type Permission,
  type RoleCode,
} from "@/lib/auth/permissions";

const PERMISSION_SET = new Set<string>(ALL_PERMISSIONS);
const SYSTEM_ROLE_SET = new Set<string>(SYSTEM_ROLE_CODES);

export type RoleGrantRow = {
  code: string;
  permissionsJson: string | null | undefined;
  permissionCatalogVersion?: number | null;
};

export function isPermission(value: string): value is Permission {
  return PERMISSION_SET.has(value);
}

export function isSystemRoleCode(code: string): code is RoleCode {
  return SYSTEM_ROLE_SET.has(code);
}

/** System code or a known pre-matrix alias; null for anything else. */
export function resolveRoleCode(raw: string | null | undefined): RoleCode | null {
  const code = raw?.trim().toUpperCase() ?? "";
  if (isSystemRoleCode(code)) return code;
  return ROLE_ALIASES[code] ?? null;
}

export function permissionsForRole(code: string): Permission[] {
  const resolved = resolveRoleCode(code);
  return resolved ? [...ROLE_TEMPLATES[resolved]] : [];
}

/** Dedupe and drop codes outside the catalog. */
export function serializePermissions(perms: readonly string[]): string {
  return JSON.stringify([...new Set(perms.filter(isPermission))]);
}

export function parsePermissions(json: string | null | undefined): Permission[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((p): p is Permission => typeof p === "string" && isPermission(p)))];
  } catch {
    return [];
  }
}

/** Null, blank, broken or non-array JSON. A valid array (including `[]`) is a decision. */
export function permissionsJsonNeedsTemplate(json: string | null | undefined): boolean {
  if (!json?.trim()) return true;
  try {
    return !Array.isArray(JSON.parse(json));
  } catch {
    return true;
  }
}

/**
 * Version 0 means the row predates the matrix: its `[]` is the column default,
 * so it takes a template once. From version 1 on, `[]` is authoritative.
 */
export function roleNeedsCutoverTemplate(row: RoleGrantRow): boolean {
  if (permissionsJsonNeedsTemplate(row.permissionsJson)) return true;
  return (row.permissionCatalogVersion ?? 0) === 0 && parsePermissions(row.permissionsJson).length === 0;
}

export function cutoverTemplateCode(code: string): RoleCode {
  return resolveRoleCode(code) ?? LEGACY_FALLBACK_ROLE;
}

export function effectiveRolePermissions(row: RoleGrantRow): Permission[] {
  if (roleNeedsCutoverTemplate(row)) return [...ROLE_TEMPLATES[cutoverTemplateCode(row.code)]];
  return parsePermissions(row.permissionsJson);
}
