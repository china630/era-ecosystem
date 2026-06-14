import {
  bakuYmd,
  computeTrialExpiresAtBaku,
  computeTrialExpiresEndOfMonthBaku,
} from "./trial-date.util";

function bakuParts(d: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Baku",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
}

function part(d: Date, type: string) {
  return bakuParts(d).find((p) => p.type === type)?.value;
}

describe("computeTrialExpiresEndOfMonthBaku", () => {
  it("ends on last day of month (reg + 3) — June example", () => {
    const reg = new Date("2026-06-10T10:00:00.000Z");
    const end = computeTrialExpiresEndOfMonthBaku(reg, 3);
    expect(part(end, "year")).toBe("2026");
    expect(part(end, "month")).toBe("09");
    expect(part(end, "day")).toBe("30");
    expect(part(end, "hour")).toBe("23");
    expect(part(end, "minute")).toBe("59");
  });

  it("January registration rolls to April 30", () => {
    const reg = new Date("2026-01-15T10:00:00.000Z");
    const end = computeTrialExpiresEndOfMonthBaku(reg, 3);
    expect(part(end, "year")).toBe("2026");
    expect(part(end, "month")).toBe("04");
    expect(part(end, "day")).toBe("30");
  });

  it("handles year rollover (Nov → Feb end)", () => {
    const reg = new Date("2025-11-10T10:00:00.000Z");
    const end = computeTrialExpiresEndOfMonthBaku(reg, 3);
    expect(part(end, "year")).toBe("2026");
    expect(part(end, "month")).toBe("02");
    expect(part(end, "day")).toBe("28");
  });

  it("differs from legacy same-day formula", () => {
    const reg = new Date("2026-06-10T10:00:00.000Z");
    const endOfMonth = computeTrialExpiresEndOfMonthBaku(reg, 3);
    const legacy = computeTrialExpiresAtBaku(reg, 3);
    expect(part(endOfMonth, "day")).toBe("30");
    expect(part(legacy, "day")).toBe("10");
  });
});

describe("bakuYmd", () => {
  it("reads registration calendar date in Baku", () => {
    const reg = new Date("2026-06-10T10:00:00.000Z");
    expect(bakuYmd(reg)).toEqual({ y: 2026, m: 6, day: 10 });
  });
});
