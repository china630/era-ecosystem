import {
  dailyInterestMinor,
  normalizeDayCountConvention,
  type DayCountConvention,
} from "../../common/interest-daycount.util";

export type { DayCountConvention };

/** @deprecated Prefer dailyInterestMinor with convention — kept for call-site clarity. */
export function dailyDepositInterestMinor(
  principalMinor: bigint,
  rateAnnual: number,
  convention: string | DayCountConvention = "ACT_365",
): bigint {
  return dailyInterestMinor(
    principalMinor,
    rateAnnual,
    normalizeDayCountConvention(convention),
  );
}

export function businessDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}
