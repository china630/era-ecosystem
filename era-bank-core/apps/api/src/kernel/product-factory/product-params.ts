import { BadRequestException } from "@nestjs/common";
import { ProductKind } from "@era/bank-core-database";
import {
  productParamHints,
  validateKindSpecificParams,
} from "../../common/fc2-fc7.util";

/** Pricing / term corridor keys (optional on template). */
export type ProductBandKeys = {
  termMonthsMin?: number;
  termMonthsMax?: number;
  rateAnnualMin?: number;
  rateAnnualMax?: number;
};

export type CurrentProductParams = {
  glLiabilityCode: string;
  overdraftAllowed?: boolean;
};

export type DepositProductParams = ProductBandKeys & {
  termMonths: number;
  rateAnnual: number;
  glLiabilityCode: string;
  glInterestExpenseCode?: string;
  adifEligible?: boolean;
  dayCountConvention?: string;
  rateType?: "FIXED" | "FLOATING";
  indexKey?: string;
  spreadBps?: number;
  resetFrequencyMonths?: number;
  rateFloor?: number;
};

export type LoanProductParams = ProductBandKeys & {
  termMonths: number;
  rateAnnual: number;
  glAssetCode: string;
  glInterestIncomeCode: string;
  dayCountConvention?: string;
  rateType?: "FIXED" | "FLOATING";
  indexKey?: string;
  spreadBps?: number;
  resetFrequencyMonths?: number;
  rateFloor?: number;
};

export type CardProductParams = {
  scheme: string;
  cardType: string;
  dailySpendLimitMinor: number;
  atmDailyLimitMinor: number;
  perTxnMaxMinor?: number;
};

export type ProductParamsByKind = {
  CURRENT: CurrentProductParams;
  TERM_DEPOSIT: DepositProductParams;
  SAVINGS: DepositProductParams;
  LOAN_ANNUITY: LoanProductParams;
  LOAN_DIFF: LoanProductParams;
  CARD: CardProductParams;
};

export const PRODUCT_MODULE_KEY_BY_KIND: Partial<Record<ProductKind, string>> = {
  CURRENT: "banking_core",
  TERM_DEPOSIT: "banking_deposits",
  SAVINGS: "banking_deposits",
  CALL_DEPOSIT: "banking_deposits",
  STRUCTURED_DEPOSIT: "banking_deposits",
  LOAN_ANNUITY: "banking_loans",
  LOAN_DIFF: "banking_loans",
  LOAN_LINE: "banking_loans",
  LOAN_MORTGAGE: "banking_loans",
  LOAN_LEASE: "banking_loans",
  LOAN_FACTORING: "banking_loans",
  LOAN_MFI: "banking_loans",
  LOAN_TRADE: "banking_loans",
  LOAN_SYNDICATED: "banking_loans",
  LOAN_PROJECT: "banking_loans",
  MURABAHA: "banking_loans",
  MUDARABAH: "banking_loans",
  CARD: "banking_cards",
};

const DEPOSIT_KINDS: ProductKind[] = [
  ProductKind.TERM_DEPOSIT,
  ProductKind.SAVINGS,
];
const LOAN_KINDS: ProductKind[] = [
  ProductKind.LOAN_ANNUITY,
  ProductKind.LOAN_DIFF,
];

function asRecord(paramsJson: unknown): Record<string, unknown> {
  if (!paramsJson || typeof paramsJson !== "object" || Array.isArray(paramsJson)) {
    throw new BadRequestException("paramsJson must be a non-array object");
  }
  return paramsJson as Record<string, unknown>;
}

function reqString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== "string" || !v.trim()) {
    throw new BadRequestException(`paramsJson.${key} is required`);
  }
  return v.trim();
}

function optString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") {
    throw new BadRequestException(`paramsJson.${key} must be a string`);
  }
  const t = v.trim();
  return t || undefined;
}

function reqNumber(obj: Record<string, unknown>, key: string): number {
  const v = obj[key];
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new BadRequestException(`paramsJson.${key} must be a finite number`);
  }
  return v;
}

function optNumber(obj: Record<string, unknown>, key: string): number | undefined {
  const v = obj[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new BadRequestException(`paramsJson.${key} must be a finite number`);
  }
  return v;
}

function optBoolean(obj: Record<string, unknown>, key: string): boolean | undefined {
  const v = obj[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "boolean") {
    throw new BadRequestException(`paramsJson.${key} must be a boolean`);
  }
  return v;
}

function parseBands(obj: Record<string, unknown>): ProductBandKeys {
  return {
    termMonthsMin: optNumber(obj, "termMonthsMin"),
    termMonthsMax: optNumber(obj, "termMonthsMax"),
    rateAnnualMin: optNumber(obj, "rateAnnualMin"),
    rateAnnualMax: optNumber(obj, "rateAnnualMax"),
  };
}

function assertBandOrder(bands: ProductBandKeys): void {
  if (
    bands.termMonthsMin != null &&
    bands.termMonthsMax != null &&
    bands.termMonthsMin > bands.termMonthsMax
  ) {
    throw new BadRequestException("termMonthsMin must be <= termMonthsMax");
  }
  if (
    bands.rateAnnualMin != null &&
    bands.rateAnnualMax != null &&
    bands.rateAnnualMin > bands.rateAnnualMax
  ) {
    throw new BadRequestException("rateAnnualMin must be <= rateAnnualMax");
  }
}

function parseCurrent(obj: Record<string, unknown>): CurrentProductParams {
  return {
    glLiabilityCode: reqString(obj, "glLiabilityCode"),
    overdraftAllowed: optBoolean(obj, "overdraftAllowed"),
  };
}

function parseRateType(obj: Record<string, unknown>): {
  rateType?: "FIXED" | "FLOATING";
  indexKey?: string;
  spreadBps?: number;
  resetFrequencyMonths?: number;
  rateFloor?: number;
  dayCountConvention?: string;
} {
  const rateTypeRaw = optString(obj, "rateType");
  let rateType: "FIXED" | "FLOATING" | undefined;
  if (rateTypeRaw) {
    const u = rateTypeRaw.toUpperCase();
    if (u !== "FIXED" && u !== "FLOATING") {
      throw new BadRequestException("paramsJson.rateType must be FIXED or FLOATING");
    }
    rateType = u;
  }
  const dayCountConvention = optString(obj, "dayCountConvention");
  if (
    dayCountConvention &&
    !["ACT_365", "ACT_360", "THIRTY_360"].includes(dayCountConvention)
  ) {
    throw new BadRequestException(
      "paramsJson.dayCountConvention must be ACT_365, ACT_360, or THIRTY_360",
    );
  }
  return {
    rateType,
    indexKey: optString(obj, "indexKey"),
    spreadBps: optNumber(obj, "spreadBps"),
    resetFrequencyMonths: optNumber(obj, "resetFrequencyMonths"),
    rateFloor: optNumber(obj, "rateFloor"),
    dayCountConvention,
  };
}

function parseDeposit(obj: Record<string, unknown>): DepositProductParams {
  const termMonths = reqNumber(obj, "termMonths");
  const rateAnnual = reqNumber(obj, "rateAnnual");
  if (!Number.isInteger(termMonths) || termMonths < 1) {
    throw new BadRequestException("paramsJson.termMonths must be a positive integer");
  }
  if (rateAnnual < 0 || rateAnnual > 1) {
    throw new BadRequestException(
      "paramsJson.rateAnnual must be an annual fraction in [0, 1] (e.g. 0.12 for 12%)",
    );
  }
  const bands = parseBands(obj);
  assertBandOrder(bands);
  const floating = parseRateType(obj);
  if (floating.rateType === "FLOATING" && !floating.indexKey) {
    throw new BadRequestException("FLOATING deposit requires paramsJson.indexKey");
  }
  return {
    termMonths,
    rateAnnual,
    glLiabilityCode: reqString(obj, "glLiabilityCode"),
    glInterestExpenseCode: optString(obj, "glInterestExpenseCode"),
    adifEligible: optBoolean(obj, "adifEligible"),
    ...bands,
    ...floating,
  };
}

function parseLoan(obj: Record<string, unknown>): LoanProductParams {
  const termMonths = reqNumber(obj, "termMonths");
  const rateAnnual = reqNumber(obj, "rateAnnual");
  if (!Number.isInteger(termMonths) || termMonths < 1) {
    throw new BadRequestException("paramsJson.termMonths must be a positive integer");
  }
  if (rateAnnual < 0 || rateAnnual > 1) {
    throw new BadRequestException(
      "paramsJson.rateAnnual must be an annual fraction in [0, 1] (e.g. 0.18 for 18%)",
    );
  }
  const bands = parseBands(obj);
  assertBandOrder(bands);
  const floating = parseRateType(obj);
  if (floating.rateType === "FLOATING" && !floating.indexKey) {
    throw new BadRequestException("FLOATING loan requires paramsJson.indexKey");
  }
  return {
    termMonths,
    rateAnnual,
    glAssetCode: reqString(obj, "glAssetCode"),
    glInterestIncomeCode: reqString(obj, "glInterestIncomeCode"),
    ...bands,
    ...floating,
  };
}

function parseCard(obj: Record<string, unknown>): CardProductParams {
  const dailySpendLimitMinor = reqNumber(obj, "dailySpendLimitMinor");
  const atmDailyLimitMinor = reqNumber(obj, "atmDailyLimitMinor");
  const perTxnMaxMinor = optNumber(obj, "perTxnMaxMinor");
  if (!Number.isInteger(dailySpendLimitMinor) || dailySpendLimitMinor < 0) {
    throw new BadRequestException("dailySpendLimitMinor must be a non-negative integer");
  }
  if (!Number.isInteger(atmDailyLimitMinor) || atmDailyLimitMinor < 0) {
    throw new BadRequestException("atmDailyLimitMinor must be a non-negative integer");
  }
  if (perTxnMaxMinor != null && (!Number.isInteger(perTxnMaxMinor) || perTxnMaxMinor < 0)) {
    throw new BadRequestException("perTxnMaxMinor must be a non-negative integer");
  }
  return {
    scheme: reqString(obj, "scheme"),
    cardType: reqString(obj, "cardType"),
    dailySpendLimitMinor,
    atmDailyLimitMinor,
    perTxnMaxMinor,
  };
}

export type ParsedProductParams =
  | CurrentProductParams
  | DepositProductParams
  | LoanProductParams
  | CardProductParams;

export function parseProductParams(
  kind: ProductKind,
  paramsJson: unknown,
): ParsedProductParams {
  const obj = asRecord(paramsJson);
  switch (kind) {
    case ProductKind.CURRENT:
      return parseCurrent(obj);
    case ProductKind.TERM_DEPOSIT:
    case ProductKind.SAVINGS:
    case ProductKind.CALL_DEPOSIT:
    case ProductKind.STRUCTURED_DEPOSIT:
      return parseDeposit(obj);
    case ProductKind.LOAN_ANNUITY:
    case ProductKind.LOAN_DIFF:
    case ProductKind.LOAN_LINE:
    case ProductKind.LOAN_MORTGAGE:
    case ProductKind.LOAN_LEASE:
    case ProductKind.LOAN_FACTORING:
    case ProductKind.LOAN_MFI:
    case ProductKind.LOAN_TRADE:
    case ProductKind.LOAN_SYNDICATED:
    case ProductKind.LOAN_PROJECT:
    case ProductKind.MURABAHA:
    case ProductKind.MUDARABAH:
      return parseLoan(obj);
    case ProductKind.CARD:
      return parseCard(obj);
    default:
      throw new BadRequestException(`Unsupported product kind: ${String(kind)}`);
  }
}

export function validateProductParams(kind: ProductKind, paramsJson: unknown): void {
  parseProductParams(kind, paramsJson);
  if (paramsJson && typeof paramsJson === "object" && !Array.isArray(paramsJson)) {
    validateKindSpecificParams(kind, paramsJson as Record<string, unknown>);
  }
}

export function paramHintsForKind(kind: ProductKind): string[] {
  return productParamHints(kind);
}

export function moduleKeyForKind(kind: ProductKind): string {
  return PRODUCT_MODULE_KEY_BY_KIND[kind] ?? "banking_core";
}

export function isDepositKind(kind: ProductKind): boolean {
  return DEPOSIT_KINDS.includes(kind);
}

export function isLoanKind(kind: ProductKind): boolean {
  return LOAN_KINDS.includes(kind);
}

/**
 * Resolve rate/term for origination. Out-of-band requests:
 * - default: BadRequestException
 * - allowException: return { ..., pricingException: true } without throwing
 */
export function resolveRateAndTerm(input: {
  templateTermMonths: number;
  templateRateAnnual: number;
  bands: ProductBandKeys;
  requestedTermMonths?: number;
  requestedRateAnnual?: number;
  allowException?: boolean;
  exceptionReason?: string;
}): {
  termMonths: number;
  rateAnnual: number;
  pricingException: boolean;
} {
  const {
    templateTermMonths,
    templateRateAnnual,
    bands,
    requestedTermMonths,
    requestedRateAnnual,
    allowException,
    exceptionReason,
  } = input;

  let termMonths = templateTermMonths;
  let rateAnnual = templateRateAnnual;
  let pricingException = false;

  const hasTermBand =
    bands.termMonthsMin != null || bands.termMonthsMax != null;
  const hasRateBand =
    bands.rateAnnualMin != null || bands.rateAnnualMax != null;

  const markException = (msg: string) => {
    if (allowException) {
      if (!exceptionReason?.trim()) {
        throw new BadRequestException(
          "exceptionReason is required when pricingException is true",
        );
      }
      pricingException = true;
      return true;
    }
    throw new BadRequestException(msg);
  };

  if (requestedTermMonths != null) {
    if (!hasTermBand) {
      if (requestedTermMonths !== templateTermMonths) {
        if (
          !markException(
            "termMonths is fixed by the product template (no band configured)",
          )
        ) {
          /* thrown */
        } else {
          termMonths = requestedTermMonths;
        }
      }
    } else {
      const min = bands.termMonthsMin ?? 1;
      const max = bands.termMonthsMax ?? Number.MAX_SAFE_INTEGER;
      if (requestedTermMonths < min || requestedTermMonths > max) {
        if (
          !markException(
            `termMonths must be within product band [${min}, ${max}]`,
          )
        ) {
          /* thrown */
        } else {
          termMonths = requestedTermMonths;
        }
      } else {
        termMonths = requestedTermMonths;
      }
    }
  }

  if (requestedRateAnnual != null) {
    if (!hasRateBand) {
      if (Math.abs(requestedRateAnnual - templateRateAnnual) > 1e-12) {
        if (
          !markException(
            "rateAnnual is fixed by the product template (no band configured)",
          )
        ) {
          /* thrown */
        } else {
          rateAnnual = requestedRateAnnual;
        }
      }
    } else {
      const min = bands.rateAnnualMin ?? 0;
      const max = bands.rateAnnualMax ?? 1;
      if (requestedRateAnnual < min || requestedRateAnnual > max) {
        if (
          !markException(
            `rateAnnual must be within product band [${min}, ${max}]`,
          )
        ) {
          /* thrown */
        } else {
          rateAnnual = requestedRateAnnual;
        }
      } else {
        rateAnnual = requestedRateAnnual;
      }
    }
  }

  return { termMonths, rateAnnual, pricingException };
}

/** Card limits may only be tightened (≤ product max). */
export function resolveCardLimits(input: {
  product: CardProductParams;
  requested?: Partial<{
    dailySpendLimitMinor: number;
    atmDailyLimitMinor: number;
    perTxnMaxMinor: number;
  }>;
}): Record<string, number> {
  const daily =
    input.requested?.dailySpendLimitMinor ?? input.product.dailySpendLimitMinor;
  const atm =
    input.requested?.atmDailyLimitMinor ?? input.product.atmDailyLimitMinor;
  const perTxn =
    input.requested?.perTxnMaxMinor ??
    input.product.perTxnMaxMinor ??
    input.product.dailySpendLimitMinor;

  if (daily > input.product.dailySpendLimitMinor) {
    throw new BadRequestException(
      "dailySpendLimitMinor cannot exceed product maximum",
    );
  }
  if (atm > input.product.atmDailyLimitMinor) {
    throw new BadRequestException(
      "atmDailyLimitMinor cannot exceed product maximum",
    );
  }
  const productPerTxn =
    input.product.perTxnMaxMinor ?? input.product.dailySpendLimitMinor;
  if (perTxn > productPerTxn) {
    throw new BadRequestException(
      "perTxnMaxMinor cannot exceed product maximum",
    );
  }

  return {
    dailySpendLimitMinor: daily,
    atmDailyLimitMinor: atm,
    perTxnMaxMinor: perTxn,
  };
}

export function addMonthsUtc(from: Date, months: number): Date {
  const d = new Date(from.getTime());
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}
