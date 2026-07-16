import { Prisma } from "@erafinance/database";

const Decimal = Prisma.Decimal;
const RM_HALF_UP = 4;

export function utcDayStart(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0),
  );
}

/**
 * Whole calendar days from hire (UTC date) to as-of (UTC date), excluding hire day
 * (hire and as-of same calendar day => 0). Matches (asOf − hire) / 365 * norm pro-rata.
 */
export function elapsedDaysSinceHire(hireDate: Date, asOf: Date): number {
  const h = utcDayStart(hireDate).getTime();
  const a = utcDayStart(asOf).getTime();
  if (a < h) return 0;
  return Math.floor((a - h) / 86_400_000);
}

/** Inclusive calendar days in [start, end] (UTC dates). */
export function inclusiveCalendarDays(start: Date, end: Date): number {
  const s = utcDayStart(start).getTime();
  const e = utcDayStart(end).getTime();
  if (e < s) return 0;
  return Math.floor((e - s) / 86_400_000) + 1;
}

export function roundDays2(d: Prisma.Decimal): Prisma.Decimal {
  return d.toDecimalPlaces(2, RM_HALF_UP);
}

/**
 * Extra vacation days from seniority rules: pick the rule with the highest
 * `yearsFrom` where whole years of service >= yearsFrom.
 */
export function extraDaysFromSeniority(
  hireDate: Date,
  asOf: Date,
  rules: { yearsFrom: number; extraDays: number }[],
): number {
  const wholeYears = Math.floor(elapsedDaysSinceHire(hireDate, asOf) / 365);
  let best: { yearsFrom: number; extraDays: number } | null = null;
  for (const r of rules) {
    if (wholeYears >= r.yearsFrom) {
      if (!best || r.yearsFrom > best.yearsFrom) {
        best = r;
      }
    }
  }
  return best?.extraDays ?? 0;
}

/**
 * vacationDaysBalance = initialVacationDays + (elapsedDays/365)*effectiveBase − usedLaborLeaveDays
 * effectiveBase = baseVacationDaysPerYear + (seniorityExtraDaysPerYear ?? 0)
 */
export function computeVacationBalance(params: {
  hireDate: Date;
  asOf: Date;
  initialVacationDays: Prisma.Decimal;
  baseVacationDaysPerYear: number;
  usedLaborLeaveDays: Prisma.Decimal;
  /** Extra days/year from seniority (added to base for accrual). */
  seniorityExtraDaysPerYear?: number;
}): Prisma.Decimal {
  const base =
    params.baseVacationDaysPerYear + (params.seniorityExtraDaysPerYear ?? 0);
  const elapsed = elapsedDaysSinceHire(params.hireDate, params.asOf);
  const accrued = new Decimal(elapsed).div(365).mul(base);
  const raw = new Decimal(params.initialVacationDays)
    .add(accrued)
    .sub(params.usedLaborLeaveDays);
  return roundDays2(raw);
}
