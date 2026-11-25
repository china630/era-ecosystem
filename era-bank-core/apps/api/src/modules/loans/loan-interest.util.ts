import {
  dailyInterestMinor,
  normalizeDayCountConvention,
  type DayCountConvention,
} from "../../common/interest-daycount.util";

export function dailyLoanInterestMinor(
  outstandingMinor: bigint,
  rateAnnual: number,
  convention: string | DayCountConvention = "ACT_365",
): bigint {
  return dailyInterestMinor(
    outstandingMinor,
    rateAnnual,
    normalizeDayCountConvention(convention),
  );
}

export function dailyPenaltyMinor(
  overdueBaseMinor: bigint,
  penaltyRateAnnual: number,
  convention: string | DayCountConvention = "ACT_365",
): bigint {
  if (overdueBaseMinor <= 0n || penaltyRateAnnual <= 0) return 0n;
  return dailyInterestMinor(
    overdueBaseMinor,
    penaltyRateAnnual,
    normalizeDayCountConvention(convention),
  );
}

export function overdueInstallmentBaseMinor(installment: {
  principalMinor: bigint;
  interestMinor: bigint;
  paidPrincipalMinor: bigint;
  paidInterestMinor: bigint;
}): bigint {
  const p =
    installment.principalMinor > installment.paidPrincipalMinor
      ? installment.principalMinor - installment.paidPrincipalMinor
      : 0n;
  const i =
    installment.interestMinor > installment.paidInterestMinor
      ? installment.interestMinor - installment.paidInterestMinor
      : 0n;
  return p + i;
}

export function businessDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}