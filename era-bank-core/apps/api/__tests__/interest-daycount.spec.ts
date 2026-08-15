import {
  dailyInterestMinor,
  monthlyRateFactor,
  normalizeDayCountConvention,
  yearBasisDays,
} from "../src/common/interest-daycount.util";

describe("interest-daycount", () => {
  it("normalizes conventions", () => {
    expect(normalizeDayCountConvention("ACT/360")).toBe("ACT_360");
    expect(normalizeDayCountConvention("30/360")).toBe("THIRTY_360");
    expect(normalizeDayCountConvention(undefined)).toBe("ACT_365");
  });

  it("year basis", () => {
    expect(yearBasisDays("ACT_365")).toBe(365);
    expect(yearBasisDays("ACT_360")).toBe(360);
    expect(yearBasisDays("THIRTY_360")).toBe(360);
  });

  it("daily interest differs by convention", () => {
    const p = 1_000_000n;
    const r = 0.12;
    const d365 = dailyInterestMinor(p, r, "ACT_365");
    const d360 = dailyInterestMinor(p, r, "ACT_360");
    expect(d365).toBe(329n);
    expect(d360).toBe(333n);
  });

  it("monthly factor THIRTY_360 is rate/12", () => {
    expect(monthlyRateFactor(0.12, "THIRTY_360")).toBeCloseTo(0.01);
    expect(monthlyRateFactor(0.12, "ACT_365")).toBeCloseTo((0.12 * 30) / 365);
  });
});
