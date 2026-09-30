import { Decimal } from "@erafinance/database";
import { PayrollComponentCode } from "./payroll-component-codes";

/** TK AR art. 165 — overtime / holiday / rest premium rate floor. */
export const AZ_DOUBLE_RATE_FLOOR = 2;

export type TimesheetMinuteFields = {
  normalMinutes?: number | null;
  shortfallMinutes?: number | null;
  overtimeMinutes?: number | null;
  nightMinutes?: number | null;
  restDayMinutes?: number | null;
  holidayMinutes?: number | null;
  hourlyLeaveMinutes?: number | null;
  /** Wave 12: paid hourly leave excluded from unpaid deduction. */
  hourlyLeavePaid?: boolean | null;
  breakMinutes?: number | null;
  lockedFromAbsence?: boolean;
  /** When set, shortfall / hourly leave count only on WORK (wave 11). */
  entryType?: string | null;
};

export type PremiumScheduleRates = {
  nightPremiumRate: Decimal | number;
  eveningPremiumRate: Decimal | number;
  overtimePremiumRate: Decimal | number;
  holidayPremiumRate?: Decimal | number | null;
  restPremiumRate?: Decimal | number | null;
};

export type LegacyHoursRow = {
  night: number;
  evening: number;
  overtime: number;
};

export type MinuteHoursRow = {
  night: Decimal | number;
  overtime: Decimal | number;
  holiday: Decimal | number;
  rest: Decimal | number;
  unpaid: Decimal | number;
};

export type PremiumLineDraft = {
  code: PayrollComponentCode;
  amount: Decimal;
};

/** True when CP wave-10 mirror stamped any minute column on the entry. */
export function entryHasCpMinutes(e: TimesheetMinuteFields): boolean {
  return (
    e.normalMinutes != null ||
    e.shortfallMinutes != null ||
    e.overtimeMinutes != null ||
    e.nightMinutes != null ||
    e.restDayMinutes != null ||
    e.holidayMinutes != null ||
    e.hourlyLeaveMinutes != null ||
    e.breakMinutes != null
  );
}

export function minutesToHours(minutes: number): Decimal {
  return new Decimal(minutes || 0).div(60);
}

/** Floor rate at `floor` (default 2). Night must not use this. */
export function floorPremiumRate(
  rate: Decimal | number | null | undefined,
  floor = AZ_DOUBLE_RATE_FLOOR,
): Decimal {
  const r = new Decimal(rate ?? floor);
  return Decimal.max(r, floor);
}

function nonNegMinutes(value: number | null | undefined): number {
  const n = value ?? 0;
  return n > 0 ? n : 0;
}

/**
 * Aggregate CP minute buckets for one employee.
 * Hours are Decimal (minutes / 60), not IEEE floats.
 * Unpaid time: WORK days only, and not absence-locked.
 */
export function aggregateMinuteHours(
  entries: TimesheetMinuteFields[],
): MinuteHoursRow {
  let overtime = 0;
  let night = 0;
  let holiday = 0;
  let rest = 0;
  let unpaid = 0;
  for (const e of entries) {
    overtime += nonNegMinutes(e.overtimeMinutes);
    night += nonNegMinutes(e.nightMinutes);
    holiday += nonNegMinutes(e.holidayMinutes);
    rest += nonNegMinutes(e.restDayMinutes);
    if (e.lockedFromAbsence) continue;
    if (e.entryType != null && e.entryType !== "WORK") continue;
    unpaid += nonNegMinutes(e.shortfallMinutes);
    if (!e.hourlyLeavePaid) {
      unpaid += nonNegMinutes(e.hourlyLeaveMinutes);
    }
  }
  const hours = (minutes: number) => new Decimal(minutes).div(60);
  return {
    overtime: hours(overtime),
    night: hours(night),
    holiday: hours(holiday),
    rest: hours(rest),
    unpaid: hours(unpaid),
  };
}

/** Unpaid time cuts the accrual before PIT/DSMF. Post-tax deductions (alimony, loan) do not. */
export function reducesTaxableGross(code: string): boolean {
  return code === PayrollComponentCode.UNPAID_TIME;
}

/** Premium differential: hours × hourly × (rate − 1). */
export function premiumDifferential(
  hourly: Decimal,
  hours: Decimal | number,
  rate: Decimal,
): Decimal {
  const h = hours instanceof Decimal ? hours : new Decimal(hours);
  if (h.lte(0) || hourly.lte(0) || rate.lte(1)) return new Decimal(0);
  return hourly.mul(h).mul(rate.sub(1));
}

/**
 * Build slip premium / unpaid lines.
 * When `useMinutes` is true, ignore legacy overtimeHours / nightHours / eveningHours.
 */
export function buildTimesheetPremiumLines(args: {
  hourly: Decimal;
  useMinutes: boolean;
  minutes?: MinuteHoursRow | null;
  legacy?: LegacyHoursRow | null;
  schedule: PremiumScheduleRates;
}): PremiumLineDraft[] {
  const { hourly, useMinutes, minutes, legacy, schedule } = args;
  const lines: PremiumLineDraft[] = [];

  if (useMinutes && minutes) {
    const nightRate = new Decimal(schedule.nightPremiumRate);
    const otRate = floorPremiumRate(schedule.overtimePremiumRate);
    const holidayRate = floorPremiumRate(schedule.holidayPremiumRate);
    const restRate = floorPremiumRate(schedule.restPremiumRate);

    const nightExtra = premiumDifferential(hourly, minutes.night, nightRate);
    const otExtra = premiumDifferential(hourly, minutes.overtime, otRate);
    const holidayExtra = premiumDifferential(
      hourly,
      minutes.holiday,
      holidayRate,
    );
    const restExtra = premiumDifferential(hourly, minutes.rest, restRate);
    const unpaidHours = new Decimal(minutes.unpaid);
    const unpaidAmt =
      unpaidHours.gt(0) && hourly.gt(0) ? hourly.mul(unpaidHours) : new Decimal(0);

    if (nightExtra.gt(0)) {
      lines.push({ code: PayrollComponentCode.NIGHT_PREMIUM, amount: nightExtra });
    }
    if (otExtra.gt(0)) {
      lines.push({
        code: PayrollComponentCode.OVERTIME_PREMIUM,
        amount: otExtra,
      });
    }
    if (holidayExtra.gt(0)) {
      lines.push({
        code: PayrollComponentCode.HOLIDAY_PREMIUM,
        amount: holidayExtra,
      });
    }
    if (restExtra.gt(0)) {
      lines.push({ code: PayrollComponentCode.REST_PREMIUM, amount: restExtra });
    }
    if (unpaidAmt.gt(0)) {
      lines.push({ code: PayrollComponentCode.UNPAID_TIME, amount: unpaidAmt });
    }
    return lines;
  }

  if (legacy) {
    const nightExtra = premiumDifferential(
      hourly,
      legacy.night,
      new Decimal(schedule.nightPremiumRate),
    );
    const eveningExtra = premiumDifferential(
      hourly,
      legacy.evening,
      new Decimal(schedule.eveningPremiumRate),
    );
    const otExtra = premiumDifferential(
      hourly,
      legacy.overtime,
      new Decimal(schedule.overtimePremiumRate),
    );
    if (nightExtra.gt(0)) {
      lines.push({ code: PayrollComponentCode.NIGHT_PREMIUM, amount: nightExtra });
    }
    if (eveningExtra.gt(0)) {
      lines.push({
        code: PayrollComponentCode.EVENING_PREMIUM,
        amount: eveningExtra,
      });
    }
    if (otExtra.gt(0)) {
      lines.push({
        code: PayrollComponentCode.OVERTIME_PREMIUM,
        amount: otExtra,
      });
    }
  }

  return lines;
}
