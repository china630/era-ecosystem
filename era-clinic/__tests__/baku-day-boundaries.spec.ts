import { bakuDateKey, bakuDayBounds, parseBakuDateTime, todayBakuYmd } from "@/lib/baku-day";

describe("Baku operational day boundaries", () => {
  it("uses the next Baku calendar day after 20:00Z", () => {
    const atUtcMidnight = new Date("2026-09-22T20:00:00.000Z");
    expect(todayBakuYmd(atUtcMidnight)).toBe("2026-09-23");
    const { start, end } = bakuDayBounds("2026-09-23");
    expect(start.toISOString()).toBe("2026-09-22T20:00:00.000Z");
    expect(end.toISOString()).toBe("2026-09-23T20:00:00.000Z");
  });

  it("treats clinic EOD as Baku wall time on the scheduled day", () => {
    const scheduledAt = parseBakuDateTime("2026-09-23", "10:00");
    const dayEndHour = 18;
    const dayEnd = parseBakuDateTime(
      bakuDateKey(scheduledAt),
      `${String(dayEndHour).padStart(2, "0")}:00`,
    );
    expect(dayEnd.toISOString()).toBe("2026-09-23T14:00:00.000Z");
    expect(new Date("2026-09-23T13:59:59.999Z").getTime()).toBeLessThan(dayEnd.getTime());
    expect(new Date("2026-09-23T14:00:00.000Z").getTime()).toBeGreaterThanOrEqual(dayEnd.getTime());
  });
});
