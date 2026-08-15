/** Build installment schedule for annuity or declining-balance (DIFF) loans. */

import {
  monthlyRateFactor,
  normalizeDayCountConvention,
  type DayCountConvention,
} from "../../common/interest-daycount.util";

export type ScheduleRow = {
  sequenceNo: number;
  dueDate: Date;
  principalMinor: bigint;
  interestMinor: bigint;
};

export function buildLoanSchedule(input: {
  kind: "LOAN_ANNUITY" | "LOAN_DIFF";
  principalMinor: bigint;
  termMonths: number;
  rateAnnual: number;
  startDate?: Date;
  dayCountConvention?: string | DayCountConvention;
}): ScheduleRow[] {
  const n = input.termMonths;
  const convention = normalizeDayCountConvention(input.dayCountConvention);
  const monthlyRate = monthlyRateFactor(input.rateAnnual, convention);
  const start = input.startDate ?? new Date();
  const rows: ScheduleRow[] = [];

  if (input.kind === "LOAN_DIFF") {
    const principalPart = input.principalMinor / BigInt(n);
    let remaining = input.principalMinor;
    for (let i = 1; i <= n; i += 1) {
      const interestMinor = BigInt(Math.round(Number(remaining) * monthlyRate));
      const principal = i === n ? remaining : principalPart;
      remaining -= principal;
      const due = new Date(start.getTime());
      due.setMonth(due.getMonth() + i);
      rows.push({
        sequenceNo: i,
        dueDate: due,
        principalMinor: principal,
        interestMinor,
      });
    }
    return rows;
  }

  const p = Number(input.principalMinor);
  const pmt =
    monthlyRate === 0
      ? Math.round(p / n)
      : Math.round((p * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -n)));
  let remaining = input.principalMinor;
  for (let i = 1; i <= n; i += 1) {
    const interestMinor = BigInt(Math.round(Number(remaining) * monthlyRate));
    let principalPart = BigInt(pmt) - interestMinor;
    if (i === n || principalPart > remaining) {
      principalPart = remaining;
    }
    remaining -= principalPart;
    const due = new Date(start.getTime());
    due.setMonth(due.getMonth() + i);
    rows.push({
      sequenceNo: i,
      dueDate: due,
      principalMinor: principalPart,
      interestMinor,
    });
  }
  return rows;
}
