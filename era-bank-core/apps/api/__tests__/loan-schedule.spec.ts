import { buildLoanSchedule } from "../src/modules/loans/loan-schedule.util";
import {
  addCalendarMonths,
  bumpToWeekday,
} from "../src/modules/loans/loan-date.util";

describe("buildLoanSchedule", () => {
  it("builds annuity installments", () => {
    const rows = buildLoanSchedule({
      kind: "LOAN_ANNUITY",
      principalMinor: 1_000_000n,
      termMonths: 12,
      rateAnnual: 0.12,
    });
    expect(rows).toHaveLength(12);
    const principalSum = rows.reduce((s, r) => s + r.principalMinor, 0n);
    expect(principalSum).toBe(1_000_000n);
  });

  it("builds declining-balance installments", () => {
    const rows = buildLoanSchedule({
      kind: "LOAN_DIFF",
      principalMinor: 1_200_000n,
      termMonths: 12,
      rateAnnual: 0.12,
    });
    expect(rows).toHaveLength(12);
    expect(rows[0].principalMinor).toBe(100_000n);
    const principalSum = rows.reduce((s, r) => s + r.principalMinor, 0n);
    expect(principalSum).toBe(1_200_000n);
  });

  it("gracePrincipalMonths: first 3 periods are interest-only", () => {
    const rows = buildLoanSchedule({
      kind: "LOAN_ANNUITY",
      principalMinor: 1_000_000n,
      termMonths: 12,
      rateAnnual: 0.12,
      gracePrincipalMonths: 3,
    });
    expect(rows).toHaveLength(12);
    for (let i = 0; i < 3; i += 1) {
      expect(rows[i].principalMinor).toBe(0n);
      expect(rows[i].interestMinor).toBeGreaterThan(0n);
    }
    expect(rows[3].principalMinor).toBeGreaterThan(0n);
    const principalSum = rows.reduce((s, r) => s + r.principalMinor, 0n);
    expect(principalSum).toBe(1_000_000n);
  });

  it("anchors first due date when provided (bumped to weekday)", () => {
    const start = new Date("2026-01-15T00:00:00.000Z");
    // 2026-02-01 is Sunday → bumpToWeekday → Monday 2026-02-02
    const firstDue = new Date("2026-02-01T00:00:00.000Z");
    const rows = buildLoanSchedule({
      kind: "LOAN_ANNUITY",
      principalMinor: 500_000n,
      termMonths: 3,
      rateAnnual: 0.1,
      startDate: start,
      firstDueDate: firstDue,
    });
    expect(rows[0].dueDate.toISOString()).toBe(
      bumpToWeekday(firstDue).toISOString(),
    );
  });
});

describe("addCalendarMonths", () => {
  it("clamps Jan 31 + 1 month to Feb last day (not Mar 2/3)", () => {
    const jan31 = new Date("2025-01-31T12:00:00.000Z");
    const feb = addCalendarMonths(jan31, 1);
    expect(feb.getUTCMonth()).toBe(1);
    expect(feb.getUTCDate()).toBe(28);
  });

  it("handles leap year February", () => {
    const jan31 = new Date("2024-01-31T12:00:00.000Z");
    const feb = addCalendarMonths(jan31, 1);
    expect(feb.getUTCDate()).toBe(29);
  });
});

describe("bumpToWeekday", () => {
  it("moves Saturday to Monday", () => {
    const sat = new Date("2026-01-03T12:00:00.000Z"); // Saturday
    const bumped = bumpToWeekday(sat);
    expect(bumped.getUTCDay()).toBe(1);
    expect(bumped.getUTCDate()).toBe(5);
  });

  it("leaves weekday unchanged", () => {
    const wed = new Date("2026-01-07T12:00:00.000Z");
    expect(bumpToWeekday(wed).toISOString()).toBe(wed.toISOString());
  });
});