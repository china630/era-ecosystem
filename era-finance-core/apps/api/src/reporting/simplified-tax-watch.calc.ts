import { Decimal } from "@erafinance/database";

export const AZ_TAX_SCHEME_CODE = "AZ_STATUTORY";

export type TenderBucket = "cash" | "bank" | "card";

export type TenderLine = {
  /** Civil date YYYY-MM-DD (Asia/Baku business date stored on the transaction). */
  date: string;
  bucket: TenderBucket;
  /** Card paid by a person who is not on the tax register. Ignored for cash and bank. */
  population: boolean;
  amount: string;
};

export type SchemeParams = {
  vatThresholdAzn: string;
  posCoefficient: string;
  eqaimeShareLimit: string;
  defaultSimplifiedPercent: string;
  posSimplifiedPercent: string;
  posRateEffectiveFrom: string;
  posRateEffectiveTo: string;
  vatPercent: string;
};

export type TaxRegimeFamily = "SIMPLIFIED" | "PROFIT" | "PROFIT_VAT";

export type PriceReview = {
  grossAzn: string;
  netAzn: string;
  marginDropAzn: string;
  vatPercent: string;
};

export type SimplifiedWatchResult = {
  period: string;
  regime: TaxRegimeFamily;
  schemeCode: string;
  cashAzn: string;
  bankAzn: string;
  cardPopulationAzn: string;
  cardUnmarkedAzn: string;
  simplifiedTaxAmountAzn: string;
  defaultRatePercent: string;
  posRatePercent: string;
  thresholdAzn: string;
  adjustedTurnoverAzn: string;
  posCoefficient: string;
  eqaimeShare: string;
  eqaimeShareLimit: string;
  priceReview: boolean;
  priceReviewReasons: Array<"THRESHOLD" | "EQAIME_SHARE">;
  priceExample: PriceReview | null;
};

const MONEY = 2;

function d(value: string | number | Decimal): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

function money(value: Decimal): string {
  return value.toFixed(MONEY);
}

export function parseSchemeParams(raw: unknown): SchemeParams {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Tax scheme parameters are missing");
  }
  const row = raw as Record<string, unknown>;
  const keys: Array<keyof SchemeParams> = [
    "vatThresholdAzn",
    "posCoefficient",
    "eqaimeShareLimit",
    "defaultSimplifiedPercent",
    "posSimplifiedPercent",
    "posRateEffectiveFrom",
    "posRateEffectiveTo",
    "vatPercent",
  ];
  const out = {} as SchemeParams;
  for (const key of keys) {
    const value = row[key];
    if (typeof value !== "string" || value.trim() === "") {
      throw new Error(`Tax scheme parameter ${key} is missing`);
    }
    out[key] = value.trim();
  }
  return out;
}

function posRateApplies(date: string, scheme: SchemeParams): boolean {
  return date >= scheme.posRateEffectiveFrom && date <= scheme.posRateEffectiveTo;
}

function inPeriod(date: string, period: string): boolean {
  return date.slice(0, 7) === period;
}

/**
 * Read-only simplified-tax watch. Does not post a journal and does not change the regime.
 * Card without `population` is unmarked: full weight in the threshold, default rate, never 6%.
 */
export function computeSimplifiedWatch(input: {
  period: string;
  schemeCode: string;
  scheme: SchemeParams;
  regime: TaxRegimeFamily;
  pricesIncludeTax: boolean;
  lines: TenderLine[];
  registeredInvoiceTotal: string;
  registeredInvoiceCovered: string;
}): SimplifiedWatchResult {
  const scheme = input.scheme;
  const threshold = d(scheme.vatThresholdAzn);
  const coefficient = d(scheme.posCoefficient);
  const shareLimit = d(scheme.eqaimeShareLimit);
  const defaultRate = d(scheme.defaultSimplifiedPercent).div(100);
  const posRate = d(scheme.posSimplifiedPercent).div(100);

  let periodCash = d(0);
  let periodBank = d(0);
  let periodPop = d(0);
  let periodUnmarked = d(0);
  let tax = d(0);

  let windowCash = d(0);
  let windowBank = d(0);
  let windowPop = d(0);
  let windowUnmarked = d(0);

  for (const line of input.lines) {
    const amount = d(line.amount);
    const populationCard = line.bucket === "card" && line.population;
    const unmarkedCard = line.bucket === "card" && !line.population;
    const inPosWindow = populationCard && posRateApplies(line.date, scheme);
    if (line.bucket === "cash") windowCash = windowCash.plus(amount);
    else if (line.bucket === "bank") windowBank = windowBank.plus(amount);
    else if (inPosWindow) windowPop = windowPop.plus(amount);
    else if (populationCard || unmarkedCard) windowUnmarked = windowUnmarked.plus(amount);

    if (!inPeriod(line.date, input.period)) continue;
    if (line.bucket === "cash") periodCash = periodCash.plus(amount);
    else if (line.bucket === "bank") periodBank = periodBank.plus(amount);
    else if (populationCard) periodPop = periodPop.plus(amount);
    else if (unmarkedCard) periodUnmarked = periodUnmarked.plus(amount);

    const rate =
      populationCard && posRateApplies(line.date, scheme) ? posRate : defaultRate;
    tax = tax.plus(amount.mul(rate));
  }

  const adjusted = windowCash
    .plus(windowBank)
    .plus(windowUnmarked)
    .plus(windowPop.mul(coefficient));

  const registeredTotal = d(input.registeredInvoiceTotal);
  const covered = d(input.registeredInvoiceCovered);
  const share = registeredTotal.gt(0) ? covered.div(registeredTotal) : d(0);

  const reasons: Array<"THRESHOLD" | "EQAIME_SHARE"> = [];
  if (input.regime === "SIMPLIFIED" && adjusted.gte(threshold)) reasons.push("THRESHOLD");
  if (input.regime === "SIMPLIFIED" && registeredTotal.gt(0) && share.gt(shareLimit)) {
    reasons.push("EQAIME_SHARE");
  }
  const priceReview = reasons.length > 0;

  let priceExample: PriceReview | null = null;
  if (priceReview && input.pricesIncludeTax) {
    const gross = d(100);
    const net = gross.div(d(1).plus(d(scheme.vatPercent).div(100)));
    priceExample = {
      grossAzn: money(gross),
      netAzn: money(net),
      marginDropAzn: money(gross.minus(net)),
      vatPercent: scheme.vatPercent,
    };
  }

  return {
    period: input.period,
    regime: input.regime,
    schemeCode: input.schemeCode,
    cashAzn: money(periodCash),
    bankAzn: money(periodBank),
    cardPopulationAzn: money(periodPop),
    cardUnmarkedAzn: money(periodUnmarked),
    simplifiedTaxAmountAzn: money(tax),
    defaultRatePercent: scheme.defaultSimplifiedPercent,
    posRatePercent: scheme.posSimplifiedPercent,
    thresholdAzn: money(threshold),
    adjustedTurnoverAzn: money(adjusted),
    posCoefficient: scheme.posCoefficient,
    eqaimeShare: share.toFixed(4),
    eqaimeShareLimit: scheme.eqaimeShareLimit,
    priceReview,
    priceReviewReasons: reasons,
    priceExample,
  };
}

/** First civil day of the 12 months that end in the month of `periodEnd` (YYYY-MM-DD). */
export function rollingTwelveMonthStart(periodEnd: string): string {
  const [year, month] = periodEnd.split("-").map(Number);
  const index = year * 12 + (month - 1) - 11;
  const startYear = Math.floor(index / 12);
  const startMonth = (index % 12) + 1;
  return monthStartYmd(startYear, startMonth);
}

export function monthEndYmd(year: number, month: number): string {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

export function monthStartYmd(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

export function quarterBounds(year: number, month: number): { start: string; end: string } {
  const qStartMonth = Math.floor((month - 1) / 3) * 3 + 1;
  const qEndMonth = qStartMonth + 2;
  return {
    start: monthStartYmd(year, qStartMonth),
    end: monthEndYmd(year, qEndMonth),
  };
}
