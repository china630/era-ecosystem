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
  if (!paramsJson || typeof paramsJson !== "object" || Array.isArray(paramsJson)) {
    throw new Error(`Product template paramsJson missing or invalid; required ${key}`);
  }
  const value = (paramsJson as Record<string, unknown>)[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Product template paramsJson.${key} is required`);
  }
  return value.trim();
}
