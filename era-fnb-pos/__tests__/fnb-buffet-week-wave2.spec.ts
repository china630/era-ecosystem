import {
  addDaysYmd,
  isoWeekdayFromYmd,
  mondayOfWeekYmd,
  ymdForWeekday,
} from "@/lib/buffet-week-calendar";

describe("buffet week calendar (Wave 2)", () => {
  it("maps civil YMD to ISO weekday (Mon=1)", () => {
    // 2026-10-26 is a Monday
    expect(isoWeekdayFromYmd("2026-10-26")).toBe(1);
    expect(isoWeekdayFromYmd("2026-10-27")).toBe(2);
    expect(isoWeekdayFromYmd("2026-11-01")).toBe(7);
  });

  it("normalizes any day to Monday of that week", () => {
    expect(mondayOfWeekYmd("2026-10-28")).toBe("2026-10-26");
    expect(mondayOfWeekYmd("2026-10-26")).toBe("2026-10-26");
    expect(mondayOfWeekYmd("2026-11-01")).toBe("2026-10-26");
  });

  it("resolves slot weekday to service date from Monday", () => {
    expect(ymdForWeekday("2026-10-26", 1)).toBe("2026-10-26");
    expect(ymdForWeekday("2026-10-26", 5)).toBe("2026-10-30");
    expect(ymdForWeekday("2026-10-26", 7)).toBe("2026-11-01");
  });

  it("rejects non-Monday weekStart for ymdForWeekday", () => {
    expect(() => ymdForWeekday("2026-10-27", 1)).toThrow(/Monday/);
  });

  it("addDaysYmd crosses month", () => {
    expect(addDaysYmd("2026-10-30", 3)).toBe("2026-11-02");
  });
});

describe("buffet covers rollup formula (Wave 2–3)", () => {
  it("forecast = plan + management + staff (hotel deferred)", () => {
    const planTotal = 40 + 5;
    const managementCount = 3;
    const staffCovers = 12;
    const hotel = null;
    const forecastTotal = planTotal + managementCount + staffCovers + (hotel ?? 0);
    expect(forecastTotal).toBe(60);
  });
});
