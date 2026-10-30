/**
 * Resolve recipeSku → unit COGS AZN from Finance product catalog (satellite-kit).
 */
import { searchFinanceCatalog } from "@era/satellite-kit";

export type FinanceUnitCogsResult = {
  unitCogsBySku: Record<string, number>;
  source: "finance" | "unavailable";
  missingSkus: string[];
};

/**
 * Look up unit prices for recipe SKUs. Missing / non-positive prices stay out of the map.
 */
export async function resolveUnitCogsBySkuFromFinance(args: {
  organizationId: string;
  recipeSkus: string[];
}): Promise<FinanceUnitCogsResult> {
  const wanted = [
    ...new Set(
      args.recipeSkus
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
    ),
  ];
  if (wanted.length === 0) {
    return { unitCogsBySku: {}, source: "finance", missingSkus: [] };
  }

  const { items, source } = await searchFinanceCatalog({
    organizationId: args.organizationId,
    channel: "FNB",
    limit: 500,
  });

  if (source === "unavailable") {
    return { unitCogsBySku: {}, source: "unavailable", missingSkus: wanted };
  }

  const bySku = new Map<string, number>();
  for (const row of items) {
    const sku = row.sku?.trim().toUpperCase();
    if (!sku) continue;
    const price = row.unitPrice;
    if (price == null || !Number.isFinite(Number(price)) || Number(price) < 0) continue;
    bySku.set(sku, Math.round(Number(price) * 100) / 100);
  }

  const unitCogsBySku: Record<string, number> = {};
  const missingSkus: string[] = [];
  for (const sku of wanted) {
    const p = bySku.get(sku);
    if (p != null) unitCogsBySku[sku] = p;
    else missingSkus.push(sku);
  }

  return { unitCogsBySku, source: "finance", missingSkus };
}
