/** Client-safe laundry labels and prices. No Prisma. */

export function laundryItemDisplayName(
  item: {
    name?: string | null;
    nameAz?: string | null;
    nameRu?: string | null;
    nameEn?: string | null;
  },
  locale?: string | null,
): string {
  const loc = (locale ?? "en").slice(0, 2).toLowerCase();
  if (loc === "az" && item.nameAz?.trim()) return item.nameAz.trim();
  if (loc === "ru" && item.nameRu?.trim()) return item.nameRu.trim();
  if (item.nameEn?.trim()) return item.nameEn.trim();
  return item.name?.trim() || "—";
}

export function pickLaundryUnitPrices(
  item: {
    washPrice?: number | string | null;
    ironPrice?: number | string | null;
    expressWashPrice?: number | string | null;
    expressIronPrice?: number | string | null;
  },
  express: boolean,
): { washPrice: number | null; ironPrice: number | null; missingExpress: boolean } {
  const asNum = (v: unknown): number | null => {
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  if (!express) {
    return {
      washPrice: asNum(item.washPrice),
      ironPrice: asNum(item.ironPrice),
      missingExpress: false,
    };
  }
  const wash = asNum(item.expressWashPrice);
  const iron = asNum(item.expressIronPrice);
  return {
    washPrice: wash,
    ironPrice: iron,
    missingExpress: wash == null && iron == null,
  };
}
