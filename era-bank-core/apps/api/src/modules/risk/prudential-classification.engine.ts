/**
 * CBAR prudential asset classification (lab MVP — parallel to IFRS 9 ECL).
 * DPD buckets + qualitative flags; worst category wins; rates loaded from DB.
 */
import type { PrudentialCategory } from "@era/bank-core-database";
import { computeEclMinor } from "./ecl.engine";

export type PrudentialRateRow = {
  category: PrudentialCategory;
  dpdMin: number;
  dpdMax: number | null;
  provisionRate: number;
  rateLabel: string;
};

export const PRUDENTIAL_CATEGORY_RANK: Record<PrudentialCategory, number> = {
  QENAETBEXS: 0,
  NEZARET: 1,
  ELAVE_RISK: 2,
  QEYRI_QENAETBEXS: 3,
  TEHLUKELI: 4,
  UMIDSIZ: 5,
};

/** Qualitative downgrade flags → minimum prudential category (worst-of merge). */
export const QUALITY_FLAG_CATEGORY: Record<string, PrudentialCategory> = {
  WATCHLIST: "NEZARET",
  SPECIAL_MENTION: "ELAVE_RISK",
  RESTRUCTURED: "ELAVE_RISK",
  SUBSTANDARD: "QEYRI_QENAETBEXS",
  DOUBTFUL: "TEHLUKELI",
  LOSS: "UMIDSIZ",
};

export function classifyCategoryFromDpd(
  dpd: number,
  rateRows: PrudentialRateRow[],
): PrudentialCategory {
  const sorted = [...rateRows].sort((a, b) => a.dpdMin - b.dpdMin);
  for (const row of sorted) {
    const withinMax =
      row.dpdMax == null || dpd <= row.dpdMax;
    if (dpd >= row.dpdMin && withinMax) {
      return row.category;
    }
  }
  const fallback = sorted[sorted.length - 1];
  return fallback?.category ?? "UMIDSIZ";
}

export function classifyCategoryFromQualityFlags(
  flags: string[],
): PrudentialCategory | null {
  let worst: PrudentialCategory | null = null;
  let worstRank = -1;
  for (const flag of flags) {
    const cat = QUALITY_FLAG_CATEGORY[flag];
    if (!cat) continue;
    const rank = PRUDENTIAL_CATEGORY_RANK[cat];
    if (rank > worstRank) {
      worstRank = rank;
      worst = cat;
    }
  }
  return worst;
}

export function resolveWorstCategory(
  dpdCategory: PrudentialCategory,
  qualityCategory: PrudentialCategory | null,
): PrudentialCategory {
  if (!qualityCategory) return dpdCategory;
  const dpdRank = PRUDENTIAL_CATEGORY_RANK[dpdCategory];
  const qualRank = PRUDENTIAL_CATEGORY_RANK[qualityCategory];
  return qualRank > dpdRank ? qualityCategory : dpdCategory;
}

export function lookupProvisionRate(
  category: PrudentialCategory,
  rateRows: PrudentialRateRow[],
): { rate: number; rateLabel: string } {
  const row = rateRows.find((r) => r.category === category);
  if (!row) {
    throw new Error(`Prudential rate missing for category ${category}`);
  }
  return { rate: row.provisionRate, rateLabel: row.rateLabel };
}

export function computeProvisionMinor(
  outstandingMinor: bigint,
  rate: number,
): bigint {
  return computeEclMinor(outstandingMinor, rate);
}

export type PrudentialLoanInput = {
  loanId: string;
  outstandingMinor: bigint;
  dpd: number;
  qualityFlags?: string[];
};

export type PrudentialLoanResult = {
  loanId: string;
  category: PrudentialCategory;
  dpd: number;
  qualityFlags: string[];
  rate: number;
  provisionMinor: bigint;
};

export function classifyLoanPrudential(
  input: PrudentialLoanInput,
  rateRows: PrudentialRateRow[],
): PrudentialLoanResult {
  const qualityFlags = input.qualityFlags ?? [];
  const dpdCategory = classifyCategoryFromDpd(input.dpd, rateRows);
  const qualityCategory = classifyCategoryFromQualityFlags(qualityFlags);
  const category = resolveWorstCategory(dpdCategory, qualityCategory);
  const { rate } = lookupProvisionRate(category, rateRows);
  const provisionMinor = computeProvisionMinor(input.outstandingMinor, rate);
  return {
    loanId: input.loanId,
    category,
    dpd: input.dpd,
    qualityFlags,
    rate,
    provisionMinor,
  };
}

export function classifyPrudentialBatch(
  loans: PrudentialLoanInput[],
  rateRows: PrudentialRateRow[],
): {
  results: PrudentialLoanResult[];
  totalOutstandingMinor: bigint;
  totalProvisionMinor: bigint;
} {
  const results = loans.map((l) => classifyLoanPrudential(l, rateRows));
  let totalOutstandingMinor = 0n;
  let totalProvisionMinor = 0n;
  for (const loan of loans) {
    totalOutstandingMinor += loan.outstandingMinor;
  }
  for (const r of results) {
    totalProvisionMinor += r.provisionMinor;
  }
  return { results, totalOutstandingMinor, totalProvisionMinor };
}