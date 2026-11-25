/**
 * IFRS 16 lessor lab helpers — net investment + annuity finance income.
 * Methodology=lab; not certified IFRS 16.
 * Money amounts stay bigint; rates scale via mulRateRound (no Number(amount)).
 */

import { mulRateRound } from "../../common/money-rate.util";

export type LeaseScheduleLine = {
  sequenceNo: number;
  dueDate: Date;
  principalMinor: bigint;
  interestMinor: bigint;
  vatMinor: bigint;
  paymentMinor: bigint;
  remainingNetInvestmentMinor: bigint;
};

export function buildFinanceLeaseSchedule(input: {
  netInvestmentMinor: bigint;
  residualValueMinor: bigint;
  termMonths: number;
  rateAnnual: number;
  startDate?: Date;
}): LeaseScheduleLine[] {
  const n = input.termMonths;
  if (n < 1) throw new Error("termMonths must be at least 1");
  const net = input.netInvestmentMinor;
  if (net < 0n) throw new Error("netInvestmentMinor must be non-negative");
  const residual = input.residualValueMinor < 0n ? 0n : input.residualValueMinor;
  const start = input.startDate ?? new Date();
  const monthlyRate = Number(input.rateAnnual) / 12;
  const principalBase = net > residual ? net - residual : net;
  const rows: LeaseScheduleLine[] = [];
  let remaining = principalBase;
  const equalPrincipal =
    n > 0 ? principalBase / BigInt(n) : 0n;

  for (let i = 1; i <= n; i += 1) {
    const dueDate = new Date(
      Date.UTC(
        start.getUTCFullYear(),
        start.getUTCMonth() + i,
        Math.min(start.getUTCDate(), 28),
      ),
    );
    const interestMinor =
      monthlyRate > 0 ? mulRateRound(remaining, monthlyRate) : 0n;
    let principalMinor = i === n ? remaining : equalPrincipal;
    if (principalMinor > remaining) principalMinor = remaining;
    remaining -= principalMinor;
    const paymentMinor = principalMinor + interestMinor;
    rows.push({
      sequenceNo: i,
      dueDate,
      principalMinor,
      interestMinor,
      vatMinor: 0n,
      paymentMinor,
      remainingNetInvestmentMinor: remaining + residual,
    });
  }
  return rows;
}

export function buyoutQuoteMinor(input: {
  residualValueMinor: bigint;
  remainingPrincipalMinor: bigint;
}): bigint {
  const r = input.residualValueMinor < 0n ? 0n : input.residualValueMinor;
  const p =
    input.remainingPrincipalMinor < 0n ? 0n : input.remainingPrincipalMinor;
  return r + p;
}

/** Lab daily finance income on net investment (ACT/365). */
export function dailyFinanceIncomeMinor(
  netInvestmentMinor: bigint,
  rateAnnual: number,
): bigint {
  if (netInvestmentMinor <= 0n || rateAnnual <= 0) return 0n;
  return mulRateRound(netInvestmentMinor, rateAnnual / 365);
}
