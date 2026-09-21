/**
 * Dual-read aliases retired (greenfield / test fleet — re-login required).
 * Empty map kept so existing re-exports still type-check.
 */
export const LEGACY_CP_PERMISSION_ALIASES: Record<string, string> = {};

export function normalizeCpPermissionCode(code: string): string {
  return code;
}

export function sessionHasAnyCpPermission(
  granted: readonly string[] | null | undefined,
  required: readonly string[],
): boolean {
  if (!required.length) return true;
  const set = new Set(granted ?? []);
  return required.some((r) => set.has(r));
}
