import { Decimal } from "@erafinance/database";
import { PayrollComponentCode } from "./payroll-component-codes";
import {
  aggregateMinuteHours,
  buildTimesheetPremiumLines,
  floorPremiumRate,
  premiumDifferential,
  reducesTaxableGross,
} from "./payroll-minute-premiums";

describe("payroll-minute-premiums (wave 11)", () => {
  const hourly = new Decimal(10); // AZN/hour
  const schedule = {
    nightPremiumRate: 1.5,
    eveningPremiumRate: 1.2,
    overtimePremiumRate: 1.5, // below floor — minutes path must use 2
    holidayPremiumRate: 2,
    restPremiumRate: 2,
  };

  it("floors overtime rate at 2 when schedule is 1.5 (60 OT minutes → ×2 differential)", () => {
    const lines = buildTimesheetPremiumLines({
      hourly,
      useMinutes: true,
      minutes: {
        night: 0,
        overtime: 1, // 60 minutes
        holiday: 0,
        rest: 0,
        unpaid: 0,
      },
      schedule,
    });
    expect(lines).toHaveLength(1);
    expect(lines[0].code).toBe(PayrollComponentCode.OVERTIME_PREMIUM);
    // hourly × 1h × (2 − 1) = 10
    expect(lines[0].amount.toString()).toBe("10");
    expect(floorPremiumRate(1.5).toString()).toBe("2");
  });

  it("prices night minutes as NIGHT_PREMIUM at schedule night rate (not overtime)", () => {
    const lines = buildTimesheetPremiumLines({
      hourly,
      useMinutes: true,
      minutes: {
        night: 2,
        overtime: 0,
        holiday: 0,
        rest: 0,
        unpaid: 0,
      },
      schedule,
    });
    expect(lines.map((l) => l.code)).toEqual([
      PayrollComponentCode.NIGHT_PREMIUM,
    ]);
    // 10 × 2 × (1.5 − 1) = 10
    expect(lines[0].amount.toString()).toBe("10");
  });

  it("keeps holiday and rest as separate premiums", () => {
    const lines = buildTimesheetPremiumLines({
      hourly,
      useMinutes: true,
      minutes: {
        night: 0,
        overtime: 0,
        holiday: 1,
        rest: 1,
        unpaid: 0,
      },
      schedule,
    });
    const codes = lines.map((l) => l.code);
    expect(codes).toContain(PayrollComponentCode.HOLIDAY_PREMIUM);
    expect(codes).toContain(PayrollComponentCode.REST_PREMIUM);
    expect(codes).not.toContain(PayrollComponentCode.OVERTIME_PREMIUM);
    // each: 10 × 1 × (2 − 1) = 10
    expect(
      lines.find((l) => l.code === PayrollComponentCode.HOLIDAY_PREMIUM)!
        .amount.toString(),
    ).toBe("10");
    expect(
      lines.find((l) => l.code === PayrollComponentCode.REST_PREMIUM)!
        .amount.toString(),
    ).toBe("10");
  });

  it("deducts UNPAID_TIME from shortfall + hourly leave; skips absence-locked days", () => {
    const agg = aggregateMinuteHours([
      {
        shortfallMinutes: 60,
        hourlyLeaveMinutes: 30,
        lockedFromAbsence: false,
      },
      {
        shortfallMinutes: 120,
        hourlyLeaveMinutes: 0,
        lockedFromAbsence: true,
      },
    ]);
    expect(agg.unpaid.eq("1.5")).toBe(true); // 90 min only from unlocked WORK (type omitted)

    const lines = buildTimesheetPremiumLines({
      hourly,
      useMinutes: true,
      minutes: agg,
      schedule,
    });
    const unpaid = lines.find((l) => l.code === PayrollComponentCode.UNPAID_TIME);
    expect(unpaid).toBeDefined();
    // 10 × 1.5 = 15
    expect(unpaid!.amount.toString()).toBe("15");
  });

  it("legacy overtimeHours path unchanged when minutes empty (no floor override)", () => {
    const lines = buildTimesheetPremiumLines({
      hourly,
      useMinutes: false,
      legacy: { night: 0, evening: 0, overtime: 1 },
      schedule,
    });
    expect(lines).toHaveLength(1);
    expect(lines[0].code).toBe(PayrollComponentCode.OVERTIME_PREMIUM);
    // uses schedule 1.5 as-is: 10 × 1 × 0.5 = 5
    expect(lines[0].amount.toString()).toBe("5");
  });

  it("filled minute buckets ignore legacy overtimeHours", () => {
    const lines = buildTimesheetPremiumLines({
      hourly,
      useMinutes: true,
      minutes: {
        night: 0,
        overtime: 0,
        holiday: 0,
        rest: 0,
        unpaid: 0,
      },
      legacy: { night: 0, evening: 0, overtime: 8 },
      schedule,
    });
    expect(lines).toHaveLength(0);
  });

  it("premiumDifferential matches hours × hourly × (rate − 1)", () => {
    const amt = premiumDifferential(new Decimal(5), 2, new Decimal(2));
    expect(amt.toString()).toBe("10");
  });

  it("ignores shortfall on non-WORK days and clamps negative minutes", () => {
    const agg = aggregateMinuteHours([
      { shortfallMinutes: 60, entryType: "VACATION" },
      { shortfallMinutes: -30, overtimeMinutes: -5, entryType: "WORK" },
      { shortfallMinutes: 30, entryType: "WORK" },
    ]);
    expect(agg.unpaid.eq("0.5")).toBe(true);
    expect(agg.overtime.eq(0)).toBe(true);
  });

  it("prices one overtime minute as Decimal hours, not a 4-dp float", () => {
    const agg = aggregateMinuteHours([{ overtimeMinutes: 1, entryType: "WORK" }]);
    const lines = buildTimesheetPremiumLines({
      hourly,
      useMinutes: true,
      minutes: agg,
      schedule,
    });
    // 10 × (1/60) × (2 − 1)
    expect(lines[0].amount.toFixed(6)).toBe("0.166667");
  });

  it("UNPAID_TIME reduces taxable gross; alimony does not", () => {
    expect(reducesTaxableGross(PayrollComponentCode.UNPAID_TIME)).toBe(true);
    expect(reducesTaxableGross(PayrollComponentCode.ALIMONY)).toBe(false);
    expect(reducesTaxableGross(PayrollComponentCode.OVERTIME_PREMIUM)).toBe(
      false,
    );
  });

  it("paid hourly leave minutes do not feed UNPAID_TIME", () => {
    const agg = aggregateMinuteHours([
      {
        shortfallMinutes: 0,
        hourlyLeaveMinutes: 60,
        hourlyLeavePaid: true,
        entryType: "WORK",
      },
      {
        shortfallMinutes: 30,
        hourlyLeaveMinutes: 30,
        hourlyLeavePaid: false,
        entryType: "WORK",
      },
    ]);
    expect(agg.unpaid.eq(1)).toBe(true);
  });
});
