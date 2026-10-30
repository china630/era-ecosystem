/**
 * HYBRID buffet FOOD cost-run formula (Wave 5).
 * Canon: docs/adr/fnb-buffet-cost-attribution.md §3
 *
 * residual = usage − attributed
 * variance = residual − theoretical
 * Soft warnings vs configurable actual/theoretical % band (no auto BOM issue).
 */

export type BuffetCostReliability = "COMPLETE" | "ISSUES_ONLY";

export type SkuUsageRowInput = {
  sku: string;
  name?: string;
  usageAzn: number;
  /** Norm / TTK theoretical for the period; omit → no SKU variance warning. */
  theoreticalAzn?: number | null;
};

export type HybridFoodCostRunInput = {
  foodUsageAzn: number;
  posSaleAzn: number;
  posCompAzn: number;
  staffNetAzn: number;
  theoreticalAzn: number;
  warningVarianceLowPct: number;
  warningVarianceHighPct: number;
  reliability: BuffetCostReliability;
  skuRows?: SkuUsageRowInput[];
};

export type SkuVarianceRow = {
  sku: string;
  name: string;
  usageAzn: number;
  theoreticalAzn: number | null;
  varianceAzn: number | null;
  /** usage/theoretical × 100 when theoretical > 0. */
  actualVsTheoreticalPct: number | null;
  warning: string | null;
};

export type HybridFoodCostRunResult = {
  foodUsageAzn: number;
  posSaleAzn: number;
  posCompAzn: number;
  posAttributedAzn: number;
  staffNetAzn: number;
  attributedAzn: number;
  residualBuffetAzn: number;
  theoreticalAzn: number;
  varianceAzn: number;
  reliability: BuffetCostReliability;
  warnings: string[];
  skuRows: SkuVarianceRow[];
};

function money(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

function moneySigned(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function clampPct(pct: number, fallback: number): number {
  if (!Number.isFinite(pct)) return fallback;
  return Math.max(0, Math.min(500, pct));
}

/**
 * Build HYBRID report slices + soft warnings (overall + per-SKU).
 */
export function buildHybridFoodCostRun(
  input: HybridFoodCostRunInput,
): HybridFoodCostRunResult {
  const foodUsageAzn = money(input.foodUsageAzn);
  const posSaleAzn = money(input.posSaleAzn);
  const posCompAzn = money(input.posCompAzn);
  const staffNetAzn = money(input.staffNetAzn);
  const theoreticalAzn = money(input.theoreticalAzn);
  const low = clampPct(input.warningVarianceLowPct, 70);
  const high = clampPct(input.warningVarianceHighPct, 110);

  const posAttributedAzn = money(posSaleAzn + posCompAzn);
  const attributedAzn = money(posAttributedAzn + staffNetAzn);
  const residualBuffetAzn = moneySigned(foodUsageAzn - attributedAzn);
  const varianceAzn = moneySigned(residualBuffetAzn - theoreticalAzn);

  const warnings: string[] = [];
  if (input.reliability === "ISSUES_ONLY") {
    warnings.push(
      "FOOD stocktake missing or incomplete for period — reliability ISSUES_ONLY",
    );
  }

  if (theoreticalAzn > 0) {
    const pct = (residualBuffetAzn / theoreticalAzn) * 100;
    if (pct < low) {
      warnings.push(
        `Residual vs theoretical ${pct.toFixed(1)}% below low band ${low}%`,
      );
    } else if (pct > high) {
      warnings.push(
        `Residual vs theoretical ${pct.toFixed(1)}% above high band ${high}%`,
      );
    }
  } else if (foodUsageAzn > 0) {
    warnings.push("Theoretical is 0 — variance band not applied at total level");
  }

  const skuRows: SkuVarianceRow[] = (input.skuRows ?? []).map((row) => {
    const usageAzn = money(row.usageAzn);
    const theo =
      row.theoreticalAzn == null || !Number.isFinite(row.theoreticalAzn)
        ? null
        : money(row.theoreticalAzn);
    let varianceAznSku: number | null = null;
    let pct: number | null = null;
    let warning: string | null = null;
    if (theo != null) {
      varianceAznSku = moneySigned(usageAzn - theo);
      if (theo > 0) {
        pct = (usageAzn / theo) * 100;
        if (pct < low) {
          warning = `SKU ${row.sku}: actual/theoretical ${pct.toFixed(1)}% < ${low}%`;
        } else if (pct > high) {
          warning = `SKU ${row.sku}: actual/theoretical ${pct.toFixed(1)}% > ${high}% (e.g. meat usage vs TTK)`;
        }
      }
    }
    if (warning) warnings.push(warning);
    return {
      sku: row.sku,
      name: row.name?.trim() || row.sku,
      usageAzn,
      theoreticalAzn: theo,
      varianceAzn: varianceAznSku,
      actualVsTheoreticalPct: pct,
      warning,
    };
  });

  return {
    foodUsageAzn,
    posSaleAzn,
    posCompAzn,
    posAttributedAzn,
    staffNetAzn,
    attributedAzn,
    residualBuffetAzn,
    theoreticalAzn,
    varianceAzn,
    reliability: input.reliability,
    warnings,
    skuRows,
  };
}
