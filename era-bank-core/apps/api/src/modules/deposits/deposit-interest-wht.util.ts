export type DepositInterestWhtInput = {
  dailyInterestMinor: bigint;
  monthInterestAccruedMinor: bigint;
  accrualMonthKey: string;
  businessMonthKey: string;
  taxExemptMonthlyMinor: number;
  depositInterestTaxRate: number;
  termMonths: number;
  exemptIfTermMonths?: number;
};

export type DepositInterestWhtResult = {
  whtMinor: bigint;
  netInterestMinor: bigint;
  grossInterestMinor: bigint;
  monthInterestAccruedMinor: bigint;
  enabled: boolean;
};

function taxableExcess(monthInterestMinor: bigint, exemptMinor: number): bigint {
  const exempt = BigInt(Math.max(0, Math.trunc(exemptMinor)));
  if (monthInterestMinor <= exempt) return 0n;
  return monthInterestMinor - exempt;
}

/** Withholding on deposit interest — incremental tax on monthly interest above exempt threshold. */
export function computeDepositInterestWht(
  input: DepositInterestWhtInput,
): DepositInterestWhtResult {
  const gross = input.dailyInterestMinor;
  if (gross <= 0n) {
    return {
      whtMinor: 0n,
      netInterestMinor: 0n,
      grossInterestMinor: 0n,
      monthInterestAccruedMinor: input.monthInterestAccruedMinor,
      enabled: false,
    };
  }

  const rate = input.depositInterestTaxRate;
  const exempt = input.taxExemptMonthlyMinor;
  if (rate <= 0 || exempt < 0) {
    return {
      whtMinor: 0n,
      netInterestMinor: gross,
      grossInterestMinor: gross,
      monthInterestAccruedMinor:
        input.accrualMonthKey === input.businessMonthKey
          ? input.monthInterestAccruedMinor + gross
          : gross,
      enabled: false,
    };
  }

  if (
    input.exemptIfTermMonths != null &&
    input.termMonths >= input.exemptIfTermMonths
  ) {
    const monthTotal =
      input.accrualMonthKey === input.businessMonthKey
        ? input.monthInterestAccruedMinor + gross
        : gross;
    return {
      whtMinor: 0n,
      netInterestMinor: gross,
      grossInterestMinor: gross,
      monthInterestAccruedMinor: monthTotal,
      enabled: true,
    };
  }

  const priorMonthInterest =
    input.accrualMonthKey === input.businessMonthKey
      ? input.monthInterestAccruedMinor
      : 0n;
  const monthAfter = priorMonthInterest + gross;

  const taxableBefore = taxableExcess(priorMonthInterest, exempt);
  const taxableAfter = taxableExcess(monthAfter, exempt);
  const incrementalTaxable = taxableAfter - taxableBefore;

  let whtMinor = 0n;
  if (incrementalTaxable > 0n) {
    // Integer tax: rate as fraction (e.g. 0.10) → apply via scaled basis points.
    // Avoid Number(money)*rate float drift for large AZN amounts.
    const rateBp = BigInt(Math.round(rate * 10_000)); // 0.10 → 1000 (of 10_000)
    whtMinor = (incrementalTaxable * rateBp + 5_000n) / 10_000n; // round half up
    if (whtMinor > gross) whtMinor = gross;
  }

  const netInterestMinor = gross - whtMinor;

  return {
    whtMinor,
    netInterestMinor,
    grossInterestMinor: gross,
    monthInterestAccruedMinor: monthAfter,
    enabled: true,
  };
}