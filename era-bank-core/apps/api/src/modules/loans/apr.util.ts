/** XIRR / APR (annualized) from dated cashflows; returns percent (e.g. 12.34 for 12.34% APR). */

export type DatedCashflow = {
  date: Date;
  /** Negative = outflow (e.g. disbursement), positive = inflow (payments). */
  amountMinor: number;
};

function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return ms / (1000 * 60 * 60 * 24);
}

function npv(rate: number, flows: DatedCashflow[], baseDate: Date): number {
  let sum = 0;
  for (const f of flows) {
    const t = daysBetween(baseDate, f.date) / 365;
    sum += f.amountMinor / Math.pow(1 + rate, t);
  }
  return sum;
}

function npvDerivative(rate: number, flows: DatedCashflow[], baseDate: Date): number {
  let sum = 0;
  for (const f of flows) {
    const t = daysBetween(baseDate, f.date) / 365;
    if (t === 0) continue;
    sum -= (t * f.amountMinor) / Math.pow(1 + rate, t + 1);
  }
  return sum;
}

/**
 * Newton-Raphson XIRR; `rate` is annual fraction (0.12 = 12%).
 * Returns APR as percent or null if no convergence.
 */
export function computeAprPercent(
  cashflows: DatedCashflow[],
  guess = 0.1,
  maxIter = 80,
): number | null {
  if (cashflows.length < 2) return null;
  const baseDate = cashflows.reduce(
    (min, f) => (f.date < min ? f.date : min),
    cashflows[0].date,
  );

  let rate = guess;
  for (let i = 0; i < maxIter; i += 1) {
    const f = npv(rate, cashflows, baseDate);
    const df = npvDerivative(rate, cashflows, baseDate);
    if (!Number.isFinite(f) || !Number.isFinite(df) || Math.abs(df) < 1e-12) {
      break;
    }
    const next = rate - f / df;
    if (!Number.isFinite(next) || next <= -0.99) {
      rate = rate / 2;
      continue;
    }
    if (Math.abs(next - rate) < 1e-9) {
      return next * 100;
    }
    rate = next;
  }
  const residual = npv(rate, cashflows, baseDate);
  if (Math.abs(residual) > 1) return null;
  return rate * 100;
}