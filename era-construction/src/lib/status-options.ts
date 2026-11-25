/** Pure helpers for CatalogField status options (client-safe). */

export function statusOptions(
  transitions: Record<string, readonly string[]>,
  current: string,
): Array<{ value: string; label: string }> {
  const next = transitions[current] ?? [];
  const values = [current, ...next.filter((s) => s !== current)];
  return values.map((value) => ({ value, label: value }));
}
