/** Build installment schedule for annuity or declining-balance (DIFF) loans. */

import {
  monthlyRateFactor,
  normalizeDayCountConvention,
  type DayCountConvention,
} from "../../common/interest-daycount.util";
import { mulRateRound } from "../../common/money-rate.util";
import { addCalendarMonths, bumpToWeekday } from "./loan-date.util";

export type LoanRepaymentFrequency = "MONTHLY" | "QUARTERLY" | "BULLET";

export type ScheduleRow = {
  sequenceNo: number;
  dueDate: Date;
  principalMinor: bigint;
  interestMinor: bigint;
};

function periodMonths(freq: LoanRepaymentFrequency): number {
  if (freq === "QUARTERLY") return 3;
  if (freq === "BULLET") return 0;
  return 1;
}

function installmentCount(
  termMonths: number,
  freq: LoanRepaymentFrequency,
): number {
  if (freq === "BULLET") return 1;
  const step = periodMonths(freq);
  return Math.max(1, Math.ceil(termMonths / step));
}

function periodRateFactor(
  rateAnnual: number,
  convention: DayCountConvention,
  freq: LoanRepaymentFrequency,
): number {
  const monthly = monthlyRateFactor(rateAnnual, convention);
  if (freq === "QUARTERLY") return monthly * 3;
  if (freq === "BULLET") {
    return (rateAnnual * termDaysForBullet(convention)) / yearDays(convention);
  }
  return monthly;
}

function yearDays(convention: DayCountConvention): number {
  return convention === "ACT_365" ? 365 : 360;
}

function termDaysForBullet(convention: DayCountConvention): number {
  return convention === "THIRTY_360" ? 360 : 365;
}

function dueDateForPeriod(
  anchor: Date,
  periodIndex: number,
  freq: LoanRepaymentFrequency,
): Date {
  const months = periodMonths(freq) * periodIndex;
  if (months <= 0) return bumpToWeekday(new Date(anchor.getTime()));
  return bumpToWeekday(addCalendarMonths(anchor, months));
}

export function buildLoanSchedule(input: {
  kind: "LOAN_ANNUITY" | "LOAN_DIFF";
  principalMinor: bigint;
  termMonths: number;
  rateAnnual: number;
  startDate?: Date;
  firstDueDate?: Date;
  dayCountConvention?: string | DayCountConvention;
  gracePrincipalMonths?: number;
  graceInterestMonths?: number;
  repaymentFrequency?: LoanRepaymentFrequency;
}): ScheduleRow[] {
  const convention = normalizeDayCountConvention(input.dayCountConvention);
  const freq = input.repaymentFrequency ?? "MONTHLY";
  const gracePrincipal = Math.max(0, input.gracePrincipalMonths ?? 0);
  const graceInterest = Math.max(0, input.graceInterestMonths ?? 0);
  const start = input.startDate ?? new Date();
  const firstDue = bumpToWeekday(
    input.firstDueDate ?? addCalendarMonths(start, periodMonths(freq) || 1),
  );
  const n = installmentCount(input.termMonths, freq);
  const periodRate = periodRateFactor(input.rateAnnual, convention, freq);
  const rows: ScheduleRow[] = [];

  const gracePrincipalPeriods =
    freq === "MONTHLY"
      ? gracePrincipal
      : Math.ceil(gracePrincipal / Math.max(1, periodMonths(freq)));
  const graceInterestPeriods =
    freq === "MONTHLY"
      ? graceInterest
      : Math.ceil(graceInterest / Math.max(1, periodMonths(freq)));

  if (input.kind === "LOAN_DIFF") {
    const principalPart = input.principalMinor / BigInt(Math.max(1, n - gracePrincipalPeriods));
    let remaining = input.principalMinor;
    for (let i = 1; i <= n; i += 1) {
      const inInterestGrace = i <= graceInterestPeriods;
      const inPrincipalGrace =
        i <= gracePrincipalPeriods && i > graceInterestPeriods;
      const interestMinor = inInterestGrace
        ? 0n
        : mulRateRound(remaining, periodRate);
      let principal = 0n;
      if (!inInterestGrace && !inPrincipalGrace) {
        principal = i === n ? remaining : principalPart;
        remaining -= principal;
      }
      rows.push({
        sequenceNo: i,
        dueDate:
          i === 1
            ? new Date(firstDue.getTime())
            : dueDateForPeriod(firstDue, i - 1, freq),
        principalMinor: principal,
        interestMinor,
      });
    }
    return rows;
  }

  const amortPeriods = Math.max(0, n - gracePrincipalPeriods - graceInterestPeriods);
  // Annuity payment factor uses float for the closed-form only; principal stays bigint.
  const periods = Math.max(1, amortPeriods || n);
  let pmtMinor: bigint;
  if (amortPeriods === 0 || periodRate === 0) {
    pmtMinor = input.principalMinor / BigInt(periods);
  } else {
    const denom = 1 - Math.pow(1 + periodRate, -amortPeriods);
    const factor = denom > 0 ? periodRate / denom : 0;
    pmtMinor = mulRateRound(input.principalMinor, factor);
  }

  let remaining = input.principalMinor;
  for (let i = 1; i <= n; i += 1) {
    const inInterestGrace = i <= graceInterestPeriods;
    const inPrincipalGrace =
      i <= gracePrincipalPeriods && i > graceInterestPeriods;
    const interestMinor = inInterestGrace
      ? 0n
      : mulRateRound(remaining, periodRate);
    let principalPart = 0n;
    if (!inInterestGrace && !inPrincipalGrace) {
      if (freq === "BULLET" && i === n) {
        principalPart = remaining;
      } else {
        principalPart = pmtMinor - interestMinor;
        if (i === n || principalPart > remaining) {
          principalPart = remaining;
        }
      }
    }
    remaining -= principalPart;
    rows.push({
      sequenceNo: i,
      dueDate:
        i === 1
          ? new Date(firstDue.getTime())
          : dueDateForPeriod(firstDue, i - 1, freq),
      principalMinor: principalPart,
      interestMinor: inInterestGrace ? 0n : interestMinor,
    });
  }
  return rows;
}