import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

export type TaxDepreciationGroupCode =
  | "BUILDINGS"
  | "EQUIPMENT_TRANSPORT"
  | "OTHER"
  | "INTANGIBLES";

type TaxDepreciationCatalogFile = {
  groups: Array<{
    code: string;
    ratePercent: number;
  }>;
};

const DEFAULT_RATES: Record<TaxDepreciationGroupCode, number> = {
  BUILDINGS: 7,
  EQUIPMENT_TRANSPORT: 25,
  OTHER: 20,
  INTANGIBLES: 10,
};

let cachedRates: Map<string, number> | null = null;

function catalogCandidatePaths(): string[] {
  const cwd = process.cwd();
  return [
    join(cwd, "packages", "database", "prisma", "catalog", "national", "tax-depreciation-groups.v1.json"),
    join(cwd, "..", "packages", "database", "prisma", "catalog", "national", "tax-depreciation-groups.v1.json"),
    join(__dirname, "..", "..", "..", "..", "packages", "database", "prisma", "catalog", "national", "tax-depreciation-groups.v1.json"),
  ];
}

async function loadCatalogRates(): Promise<Map<string, number>> {
  if (cachedRates) return cachedRates;
  for (const path of catalogCandidatePaths()) {
    if (!existsSync(path)) continue;
    try {
      const raw = JSON.parse(await readFile(path, "utf8")) as TaxDepreciationCatalogFile;
      const map = new Map<string, number>();
      for (const g of raw.groups ?? []) {
        if (g.code && Number.isFinite(g.ratePercent)) {
          map.set(g.code, g.ratePercent);
        }
      }
      if (map.size > 0) {
        cachedRates = map;
        return map;
      }
    } catch {
      // try next path
    }
  }
  cachedRates = new Map(
    Object.entries(DEFAULT_RATES).map(([code, ratePercent]) => [code, ratePercent]),
  );
  return cachedRates;
}

/** Annual tax depreciation rate as decimal fraction (e.g. 0.07 for 7%). */
export async function resolveTaxDepreciationRateFraction(
  groupCode: string,
): Promise<number> {
  const rates = await loadCatalogRates();
  const percent = rates.get(groupCode) ?? DEFAULT_RATES.OTHER;
  return percent / 100;
}

export const DEFAULT_TAX_DEPRECIATION_GROUP: TaxDepreciationGroupCode = "OTHER";
