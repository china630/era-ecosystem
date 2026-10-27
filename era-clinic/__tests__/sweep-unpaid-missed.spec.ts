import { unpaidMissedSweepPasses } from "@/domain/procedure/procedure-day-close.service";

describe("unpaidMissedSweepPasses", () => {
  const dayStart = new Date("2026-10-27T00:00:00.000+04:00");
  const dayEnd = new Date("2026-10-28T00:00:00.000+04:00");
  const dayEndHour = new Date("2026-10-27T17:00:00.000+04:00");

  it("returns no passes before dayEndHour", () => {
    const now = new Date("2026-10-27T16:59:00.000+04:00");
    expect(unpaidMissedSweepPasses(now, dayStart, dayEnd, dayEndHour)).toEqual([]);
  });

  it("returns today seated, overdue, and unseated-before-today passes after dayEndHour", () => {
    const now = new Date("2026-10-27T17:00:00.000+04:00");
    const passes = unpaidMissedSweepPasses(now, dayStart, dayEnd, dayEndHour);
    expect(passes.map((p) => p.reason)).toEqual([
      "unpaid_missed",
      "unpaid_missed_overdue",
      "unpaid_missed_unseated",
    ]);
    expect(passes[0].where).toEqual({
      resourceId: { not: null },
      scheduledAt: { gte: dayStart, lt: dayEnd },
    });
    expect(passes[1].where).toEqual({ scheduledAt: { lt: dayStart } });
    expect(passes[2].where).toEqual({
      resourceId: null,
      createdAt: { lt: dayStart },
    });
  });
});
