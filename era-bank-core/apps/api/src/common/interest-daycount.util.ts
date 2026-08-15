/** Day-count conventions for interest accrual / schedule (MVP). */
export type DayCountConvention = "ACT_365" | "ACT_360" | "THIRTY_360";

export const DAY_COUNT_CONVENTIONS: DayCountConvention[] = [
  "ACT_365",
  "ACT_360",
  "THIRTY_360",
];

export function normalizeDayCountConvention(
  raw: string | null | undefined,
): DayCountConvention {
  const v = (raw ?? "ACT_365").toUpperCase().replace("/", "_");
  if (v === "ACT_360") return "ACT_360";
  if (v === "THIRTY_360" || v === "30_360" || v === "30/360") return "THIRTY_360";
  return "ACT_365";
}

export function yearBasisDays(convention: DayCountConvention): number {
  return convention === "ACT_365" ? 365 : 360;
}

/**
 * Simple daily interest: round(principal * rateAnnual / yearDays).
 * THIRTY_360 uses 360-day year (same as ACT_360 for daily MVP).
 */
export function dailyInterestMinor(
  principalMinor: bigint,
  rateAnnual: number,
  convention: DayCountConvention = "ACT_365",
): bigint {
  if (principalMinor <= 0n || rateAnnual <= 0) return 0n;
  const days = BigInt(yearBasisDays(convention));
  const rateScaled = BigInt(Math.round(rateAnnual * 1_000_000));
  const num = principalMinor * rateScaled;
  const den = days * 1_000_000n;
  return (num + den / 2n) / den;
}

/**
 * Periodic (monthly) rate factor for installment schedules.
 * THIRTY_360 → rate/12; ACT_* → rate * 30 / yearBasis.
 */
export function monthlyRateFactor(
  rateAnnual: number,
  convention: DayCountConvention = "ACT_365",
): number {
  if (convention === "THIRTY_360") return rateAnnual / 12;
  return (rateAnnual * 30) / yearBasisDays(convention);
}
