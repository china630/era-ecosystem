/**
 * Zero-price / COMP tender tagging for buffet cost run (Wave 4).
 * Canon: docs/adr/fnb-buffet-cost-attribution.md §3 — zero-price → COMP bucket.
 *
 * F&B does not hold unit COGS; caller supplies `unitCogsBySku` (Finance later).
 * Missing recipe SKU or missing unit COGS → warning, line still tagged, AZN 0.
 */

export const COMP_PAYMENT_METHODS = [
  "COMP",
  "COMPLIMENTARY",
  "GIFT",
  "HOUSE",
] as const;

export type CompPaymentMethod = (typeof COMP_PAYMENT_METHODS)[number];
export type PosCostBucket = "SALE" | "COMP";
export type CompTagReason = "ZERO_PRICE" | "COMP_TENDER";

export type PosLineForCostRun = {
  lineId: string;
  ticketId: string;
  qty: number;
  unitPriceAzn: number;
  kitchenStatus: string;
  paymentMethod?: string | null;
  description?: string;
  recipeSku?: string | null;
  plu?: string | null;
};

export type TaggedPosCostLine = {
  lineId: string;
  ticketId: string;
  bucket: PosCostBucket;
  tagReason: CompTagReason | null;
  qty: number;
  unitPriceAzn: number;
  recipeSku: string | null;
  plu: string | null;
  description: string;
  unitCogsAzn: number | null;
  cogsAzn: number;
};

export type PosCostWarning = {
  code: "MISSING_RECIPE_SKU" | "MISSING_UNIT_COGS";
  lineId: string;
  ticketId: string;
  plu: string | null;
  recipeSku: string | null;
  message: string;
};

export type PosCostAttributionResult = {
  saleAttributedAzn: number;
  /** Named COMP bucket — never silently folded into residual alone. */
  compAttributedAzn: number;
  /** sale + comp (feeds cost-run `posAttributed`). */
  posAttributedAzn: number;
  saleLineCount: number;
  compLineCount: number;
  saleQty: number;
  compQty: number;
  lines: TaggedPosCostLine[];
  warnings: PosCostWarning[];
};

function money(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

export function isCompPaymentMethod(
  method: string | null | undefined,
): method is CompPaymentMethod {
  if (!method) return false;
  const upper = method.trim().toUpperCase();
  return (COMP_PAYMENT_METHODS as readonly string[]).includes(upper);
}

/**
 * Classify one ticket line for cost-run POS buckets.
 * VOID lines are excluded (null). COMP tender wins over price.
 */
export function classifyPosLineForCostRun(args: {
  unitPriceAzn: number;
  kitchenStatus: string;
  paymentMethod?: string | null;
}): { bucket: PosCostBucket; tagReason: CompTagReason | null } | null {
  if (args.kitchenStatus === "VOID") return null;
  if (isCompPaymentMethod(args.paymentMethod)) {
    return { bucket: "COMP", tagReason: "COMP_TENDER" };
  }
  if (money(args.unitPriceAzn) === 0) {
    return { bucket: "COMP", tagReason: "ZERO_PRICE" };
  }
  return { bucket: "SALE", tagReason: null };
}

export type UnitCogsLookup = {
  unitCogsBySku?: Record<string, number>;
  /** Fixture / demo fallback when SKU known but map empty. */
  defaultUnitCogsAzn?: number;
};

function resolveUnitCogs(
  recipeSku: string | null,
  lookup: UnitCogsLookup,
): { unitCogs: number | null; missingMap: boolean } {
  if (!recipeSku) return { unitCogs: null, missingMap: false };
  const fromMap = lookup.unitCogsBySku?.[recipeSku];
  if (fromMap != null && Number.isFinite(fromMap) && fromMap >= 0) {
    return { unitCogs: money(fromMap), missingMap: false };
  }
  if (
    lookup.defaultUnitCogsAzn != null &&
    Number.isFinite(lookup.defaultUnitCogsAzn) &&
    lookup.defaultUnitCogsAzn >= 0
  ) {
    return { unitCogs: money(lookup.defaultUnitCogsAzn), missingMap: false };
  }
  return { unitCogs: null, missingMap: true };
}

/**
 * Tag POS lines into SALE / COMP and sum COGS for the cost-run POS slice.
 */
export function attributePosLinesForCostRun(
  lines: PosLineForCostRun[],
  lookup: UnitCogsLookup = {},
): PosCostAttributionResult {
  const tagged: TaggedPosCostLine[] = [];
  const warnings: PosCostWarning[] = [];
  let saleAttributedAzn = 0;
  let compAttributedAzn = 0;
  let saleLineCount = 0;
  let compLineCount = 0;
  let saleQty = 0;
  let compQty = 0;

  for (const line of lines) {
    const classified = classifyPosLineForCostRun({
      unitPriceAzn: Number(line.unitPriceAzn),
      kitchenStatus: line.kitchenStatus,
      paymentMethod: line.paymentMethod,
    });
    if (!classified) continue;

    const recipeSku = line.recipeSku?.trim() || null;
    const plu = line.plu?.trim() || null;
    const qty = Math.max(0, Math.floor(Number(line.qty) || 0));

    if (!recipeSku) {
      warnings.push({
        code: "MISSING_RECIPE_SKU",
        lineId: line.lineId,
        ticketId: line.ticketId,
        plu,
        recipeSku: null,
        message: "Menu item has no recipeSku — COMP/SALE COGS cannot be priced",
      });
    }

    const { unitCogs, missingMap } = resolveUnitCogs(recipeSku, lookup);
    if (recipeSku && missingMap) {
      warnings.push({
        code: "MISSING_UNIT_COGS",
        lineId: line.lineId,
        ticketId: line.ticketId,
        plu,
        recipeSku,
        message: `No unit COGS for recipeSku ${recipeSku} — supply unitCogsBySku (Finance)`,
      });
    }

    const cogsAzn = unitCogs != null ? money(unitCogs * qty) : 0;
    tagged.push({
      lineId: line.lineId,
      ticketId: line.ticketId,
      bucket: classified.bucket,
      tagReason: classified.tagReason,
      qty,
      unitPriceAzn: money(Number(line.unitPriceAzn)),
      recipeSku,
      plu,
      description: line.description ?? "",
      unitCogsAzn: unitCogs,
      cogsAzn,
    });

    if (classified.bucket === "COMP") {
      compAttributedAzn = money(compAttributedAzn + cogsAzn);
      compLineCount += 1;
      compQty += qty;
    } else {
      saleAttributedAzn = money(saleAttributedAzn + cogsAzn);
      saleLineCount += 1;
      saleQty += qty;
    }
  }

  return {
    saleAttributedAzn,
    compAttributedAzn,
    posAttributedAzn: money(saleAttributedAzn + compAttributedAzn),
    saleLineCount,
    compLineCount,
    saleQty,
    compQty,
    lines: tagged,
    warnings,
  };
}
