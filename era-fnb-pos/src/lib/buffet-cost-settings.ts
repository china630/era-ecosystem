/**
 * Buffet cost attribution settings (Wave 1) + forecast pack (Wave 6).
 * Canon: docs/adr/fnb-buffet-cost-attribution.md
 */

import {
  defaultBuffetForecastPack,
  parseBuffetForecastPack,
  type BuffetForecastPack,
} from "@/lib/buffet-forecast-pack";

export type { BuffetForecastPack } from "@/lib/buffet-forecast-pack";

export const BUFFET_COST_MODELS = [
  "HYBRID",
  "RESIDUAL",
  "THEORETICAL",
  "POS_ONLY",
  "OFF",
] as const;
export type BuffetCostModel = (typeof BUFFET_COST_MODELS)[number];

export const STAFF_BUFFET_OVERLAPS = [
  "SEPARATE_CENTER",
  "OVERLAP_PCT",
  "LEFTOVER_FIRST",
] as const;
export type StaffBuffetOverlap = (typeof STAFF_BUFFET_OVERLAPS)[number];

export const COGS_POSTING_MODES = [
  "SALE_POST",
  "DAY_DOCUMENT",
  "ISSUE_TO_KITCHEN",
  "PERIOD_END",
] as const;
export type CogsPostingMode = (typeof COGS_POSTING_MODES)[number];

export const WAREHOUSE_COST_CLASSES = [
  "FOOD",
  "CHEMICAL",
  "CONSUMABLE",
  "TABLEWARE",
  "INVENTORY_GT",
] as const;
export type WarehouseCostClass = (typeof WAREHOUSE_COST_CLASSES)[number];

export const STOCKTAKE_POLICIES = [
  "WEEKLY",
  "EVERY_15_DAYS",
  "MONTHLY",
  "QUARTERLY",
  "MANUAL",
] as const;
export type StocktakePolicy = (typeof STOCKTAKE_POLICIES)[number];

export type BuffetCostOrgDefaults = {
  buffetCostModel: BuffetCostModel;
  staffBuffetOverlap: StaffBuffetOverlap;
  /** Used when overlap is OVERLAP_PCT or LEFTOVER_FIRST (0–100). */
  overlapPct: number;
  cogsPostingMode: CogsPostingMode;
  inventoryGtThresholdAzn: number;
  /** Soft warning: actual/theoretical below this % (e.g. 70). */
  warningVarianceLowPct: number;
  /** Soft warning: actual/theoretical above this % (e.g. 110). */
  warningVarianceHighPct: number;
  /** AZN per staff cover for chef-path auto staffGross (handoff). */
  staffMealAznPerCover: number;
  stocktakePolicy: Record<WarehouseCostClass, StocktakePolicy>;
};

export type BuffetCostOutletOverride = Partial<{
  buffetCostModel: BuffetCostModel;
  staffBuffetOverlap: StaffBuffetOverlap;
  overlapPct: number;
  cogsPostingMode: CogsPostingMode;
  warningVarianceLowPct: number;
  warningVarianceHighPct: number;
}>;

export type BuffetCostSettings = {
  orgDefaults: BuffetCostOrgDefaults;
  /** Partial overrides keyed by outlet id. */
  outletOverrides: Record<string, BuffetCostOutletOverride>;
  /** Guest-night bands × key SKU norms (Wave 6). */
  forecastPack: BuffetForecastPack;
};

export function defaultStocktakePolicy(): Record<WarehouseCostClass, StocktakePolicy> {
  return {
    FOOD: "WEEKLY",
    CHEMICAL: "MONTHLY",
    CONSUMABLE: "MONTHLY",
    TABLEWARE: "EVERY_15_DAYS",
    INVENTORY_GT: "QUARTERLY",
  };
}

/** Org defaults when hotelMode=true (Nafta department) → day document COGS. */
export function defaultBuffetCostOrgDefaults(hotelMode: boolean): BuffetCostOrgDefaults {
  return {
    buffetCostModel: "HYBRID",
    staffBuffetOverlap: "OVERLAP_PCT",
    overlapPct: 30,
    cogsPostingMode: hotelMode ? "DAY_DOCUMENT" : "SALE_POST",
    inventoryGtThresholdAzn: 500,
    warningVarianceLowPct: 70,
    warningVarianceHighPct: 110,
    staffMealAznPerCover: 4,
    stocktakePolicy: defaultStocktakePolicy(),
  };
}

export function defaultBuffetCostSettings(hotelMode: boolean): BuffetCostSettings {
  return {
    orgDefaults: defaultBuffetCostOrgDefaults(hotelMode),
    outletOverrides: {},
    forecastPack: defaultBuffetForecastPack(),
  };
}

function asEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function asPct(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function asPositiveMoney(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.round(n * 100) / 100;
}

function asWarningBand(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(300, Math.round(n)));
}

function normalizeStocktakePolicy(
  raw: unknown,
  fallback: Record<WarehouseCostClass, StocktakePolicy>,
): Record<WarehouseCostClass, StocktakePolicy> {
  const src =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const out = { ...fallback };
  for (const cls of WAREHOUSE_COST_CLASSES) {
    out[cls] = asEnum(src[cls], STOCKTAKE_POLICIES, fallback[cls]);
  }
  return out;
}

function normalizeOrgDefaults(
  raw: unknown,
  hotelMode: boolean,
): BuffetCostOrgDefaults {
  const base = defaultBuffetCostOrgDefaults(hotelMode);
  const src =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  let low = asWarningBand(src.warningVarianceLowPct, base.warningVarianceLowPct);
  let high = asWarningBand(src.warningVarianceHighPct, base.warningVarianceHighPct);
  if (low >= high) {
    low = base.warningVarianceLowPct;
    high = base.warningVarianceHighPct;
  }
  return {
    buffetCostModel: asEnum(src.buffetCostModel, BUFFET_COST_MODELS, base.buffetCostModel),
    staffBuffetOverlap: asEnum(
      src.staffBuffetOverlap,
      STAFF_BUFFET_OVERLAPS,
      base.staffBuffetOverlap,
    ),
    overlapPct: asPct(src.overlapPct, base.overlapPct),
    cogsPostingMode: asEnum(src.cogsPostingMode, COGS_POSTING_MODES, base.cogsPostingMode),
    inventoryGtThresholdAzn: asPositiveMoney(
      src.inventoryGtThresholdAzn,
      base.inventoryGtThresholdAzn,
    ),
    warningVarianceLowPct: low,
    warningVarianceHighPct: high,
    staffMealAznPerCover: asPositiveMoney(
      src.staffMealAznPerCover,
      base.staffMealAznPerCover,
    ),
    stocktakePolicy: normalizeStocktakePolicy(src.stocktakePolicy, base.stocktakePolicy),
  };
}

function normalizeOutletOverride(raw: unknown): BuffetCostOutletOverride | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const src = raw as Record<string, unknown>;
  const out: BuffetCostOutletOverride = {};
  if (src.buffetCostModel !== undefined) {
    out.buffetCostModel = asEnum(src.buffetCostModel, BUFFET_COST_MODELS, "HYBRID");
  }
  if (src.staffBuffetOverlap !== undefined) {
    out.staffBuffetOverlap = asEnum(
      src.staffBuffetOverlap,
      STAFF_BUFFET_OVERLAPS,
      "OVERLAP_PCT",
    );
  }
  if (src.overlapPct !== undefined) out.overlapPct = asPct(src.overlapPct, 30);
  if (src.cogsPostingMode !== undefined) {
    out.cogsPostingMode = asEnum(src.cogsPostingMode, COGS_POSTING_MODES, "DAY_DOCUMENT");
  }
  if (src.warningVarianceLowPct !== undefined) {
    out.warningVarianceLowPct = asWarningBand(src.warningVarianceLowPct, 70);
  }
  if (src.warningVarianceHighPct !== undefined) {
    out.warningVarianceHighPct = asWarningBand(src.warningVarianceHighPct, 110);
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Parse DB JSON (or null) into a full settings object. */
export function parseBuffetCostSettings(
  raw: unknown,
  hotelMode: boolean,
): BuffetCostSettings {
  const src =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const orgDefaults = normalizeOrgDefaults(src.orgDefaults ?? src, hotelMode);
  const overridesRaw =
    src.outletOverrides && typeof src.outletOverrides === "object" && !Array.isArray(src.outletOverrides)
      ? (src.outletOverrides as Record<string, unknown>)
      : {};
  const outletOverrides: Record<string, BuffetCostOutletOverride> = {};
  for (const [outletId, value] of Object.entries(overridesRaw)) {
    if (!outletId.trim()) continue;
    const normalized = normalizeOutletOverride(value);
    if (normalized) outletOverrides[outletId] = normalized;
  }
  const forecastPack = parseBuffetForecastPack(src.forecastPack);
  return { orgDefaults, outletOverrides, forecastPack };
}

/** Effective settings for one outlet (org defaults + override). */
export function resolveBuffetCostForOutlet(
  settings: BuffetCostSettings,
  outletId: string | null | undefined,
): BuffetCostOrgDefaults {
  const base = settings.orgDefaults;
  if (!outletId) return { ...base, stocktakePolicy: { ...base.stocktakePolicy } };
  const o = settings.outletOverrides[outletId];
  if (!o) return { ...base, stocktakePolicy: { ...base.stocktakePolicy } };
  let low = o.warningVarianceLowPct ?? base.warningVarianceLowPct;
  let high = o.warningVarianceHighPct ?? base.warningVarianceHighPct;
  if (low >= high) {
    low = base.warningVarianceLowPct;
    high = base.warningVarianceHighPct;
  }
  return {
    buffetCostModel: o.buffetCostModel ?? base.buffetCostModel,
    staffBuffetOverlap: o.staffBuffetOverlap ?? base.staffBuffetOverlap,
    overlapPct: o.overlapPct ?? base.overlapPct,
    cogsPostingMode: o.cogsPostingMode ?? base.cogsPostingMode,
    inventoryGtThresholdAzn: base.inventoryGtThresholdAzn,
    warningVarianceLowPct: low,
    warningVarianceHighPct: high,
    staffMealAznPerCover: base.staffMealAznPerCover,
    stocktakePolicy: { ...base.stocktakePolicy },
  };
}
