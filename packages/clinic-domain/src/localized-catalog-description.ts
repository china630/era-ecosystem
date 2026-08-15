/**
 * Align ProcedureType / ServiceCatalogCache commercial names for UI locale.
 * Prefer locale-specific description*; fall back consciously (never show RU for EN when AZ exists).
 */
export type CatalogDescriptionFields = {
  code?: string | null;
  description?: string | null;
  descriptionAz?: string | null;
  descriptionRu?: string | null;
  descriptionEn?: string | null;
};

function isAsciiLatin(s: string): boolean {
  return /^[\x20-\x7E]+$/.test(s) && /[A-Za-z]/.test(s);
}

/**
 * Resolve commercial display name for a UI locale.
 *
 * Locale preference:
 * - az → descriptionAz
 * - ru → descriptionRu
 * - en → descriptionEn, then ASCII legacy description (treated as English), then Az, then Ru
 *
 * Final fallback: legacy description → az → ru → en → code
 */
export function localizedCatalogDescription(
  row: CatalogDescriptionFields,
  locale: string,
): string {
  const loc = (locale || "en").toLowerCase().slice(0, 2);
  const az = row.descriptionAz?.trim() || "";
  const ru = row.descriptionRu?.trim() || "";
  const en = row.descriptionEn?.trim() || "";
  const legacy = row.description?.trim() || "";

  if (loc === "az") {
    return az || legacy || ru || en || row.code?.trim() || "";
  }
  if (loc === "ru") {
    return ru || legacy || az || en || row.code?.trim() || "";
  }
  if (loc === "en") {
    if (en) return en;
    if (legacy && isAsciiLatin(legacy)) return legacy;
    return az || ru || legacy || row.code?.trim() || "";
  }

  return legacy || az || ru || en || row.code?.trim() || "";
}
