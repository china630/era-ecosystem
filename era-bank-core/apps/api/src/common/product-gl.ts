/** Product Factory L3 GL mapping keys in ProductTemplate.paramsJson. */
export type ProductGlKey =
  | "glAssetCode"
  | "glLiabilityCode"
  | "glInterestIncomeCode"
  | "glInterestExpenseCode";

export function getProductGlCode(
  paramsJson: unknown,
  key: ProductGlKey,
): string {
  const value = tryProductGlCode(paramsJson, key);
  if (!value) {
    throw new Error(`Product template paramsJson.${key} is required`);
  }
  return value;
}

/** Optional product GL code; returns null when missing (caller may fall back to SystemGl). */
export function tryProductGlCode(
  paramsJson: unknown,
  key: ProductGlKey,
): string | null {
  if (!paramsJson || typeof paramsJson !== "object" || Array.isArray(paramsJson)) {
    return null;
  }
  const value = (paramsJson as Record<string, unknown>)[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  return value.trim();
}
