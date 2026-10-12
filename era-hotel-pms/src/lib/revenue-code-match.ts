/**
 * Elektra catalogs keep the English token in `name` (ROOM) and a numeric
 * department in `code` (10). Matching checks either field, code first.
 */
export function revenueTokenMatches(
  row: { code?: string | null; name?: string | null },
  token: string,
): boolean {
  const key = token.trim().toUpperCase();
  if (!key) return false;
  const code = (row.code ?? '').trim().toUpperCase();
  const name = (row.name ?? '').trim().toUpperCase();
  return code === key || name === key;
}

export function matchesAnyRevenueToken(
  row: { code?: string | null; name?: string | null },
  tokens: readonly string[],
): boolean {
  return tokens.some((token) => revenueTokenMatches(row, token));
}
