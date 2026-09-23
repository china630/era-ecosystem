import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addBakuDays,
  bakuCivilUtcDate,
  bakuDateDisplay,
  bakuDateKey,
  bakuDateTimeLabel,
  bakuDateTimeDisplay,
  bakuDayBounds,
  bakuHourMinute,
  bakuMonthBounds,
  bakuTimeLabel,
  billingPeriodKeyBaku,
  computeTrialExpiresAtBaku,
  computeTrialExpiresEndOfMonthBaku,
  parseBakuDateTime,
  previousBillingPeriodKeyBaku,
  todayBakuYmd,
} from "./baku.js";

function withTz(tz: string, fn: () => void) {
  const prev = process.env.TZ;
  process.env.TZ = tz;
  try {
    fn();
  } finally {
    if (prev === undefined) delete process.env.TZ;
    else process.env.TZ = prev;
  }
}

describe("baku clock (Asia/Baku)", () => {
  for (const tz of ["UTC", "America/New_York", "Europe/London"] as const) {
    it(`date keys independent of process TZ=${tz}`, () => {
      withTz(tz, () => {
        // Midnight Baku = 20:00Z previous UTC calendar day
        assert.equal(bakuDateKey("2026-09-21T20:00:00.000Z"), "2026-09-22");
        assert.equal(todayBakuYmd(new Date("2026-09-21T20:00:00.000Z")), "2026-09-22");
        assert.equal(bakuDateKey("2026-09-21T19:59:59.000Z"), "2026-09-21");
      });
    });
  }

  it("parseBakuDateTime anchors wall clock to +04:00", () => {
    withTz("UTC", () => {
      const d = parseBakuDateTime("2026-08-28", "18:36:00");
      assert.equal(d.toISOString(), "2026-08-28T14:36:00.000Z");
      assert.equal(bakuTimeLabel(d), "18:36");
      assert.equal(bakuDateKey(d), "2026-08-28");
      assert.equal(
        parseBakuDateTime("2026-08-28", "18:36").toISOString(),
        "2026-08-28T14:36:00.000Z",
      );
    });
  });

  it("bakuDayBounds is half-open Baku midnight", () => {
    withTz("UTC", () => {
      const { start, end, date } = bakuDayBounds("2026-09-22");
      assert.equal(date, "2026-09-22");
      assert.equal(start.toISOString(), "2026-09-21T20:00:00.000Z");
      assert.equal(end.getTime() - start.getTime(), 24 * 60 * 60 * 1000);
      assert.equal(end.toISOString(), "2026-09-22T20:00:00.000Z");
    });
  });

  it("bakuDateKey keeps YYYY-MM-DD passthrough", () => {
    assert.equal(bakuDateKey("2026-09-05"), "2026-09-05");
  });

  it("billingPeriodKeyBaku uses Baku month across UTC month boundary", () => {
    withTz("UTC", () => {
      // 2026-08-31 22:00Z = 2026-09-01 02:00 Baku → September
      assert.equal(billingPeriodKeyBaku(new Date("2026-08-31T22:00:00.000Z")), "2026-09");
      // Still August in Baku at 2026-08-31 19:00Z (23:00 Baku)
      assert.equal(billingPeriodKeyBaku(new Date("2026-08-31T19:00:00.000Z")), "2026-08");
    });
  });

  it("bakuMonthBounds and previousBillingPeriodKeyBaku", () => {
    withTz("UTC", () => {
      const { from, to } = bakuMonthBounds("2026-09");
      assert.equal(from.toISOString(), "2026-08-31T20:00:00.000Z");
      assert.equal(to.toISOString(), "2026-09-30T19:59:59.999Z");
      assert.equal(previousBillingPeriodKeyBaku(new Date("2026-09-01T00:00:00.000Z")), "2026-08");
      assert.equal(previousBillingPeriodKeyBaku(new Date("2026-01-15T12:00:00.000Z")), "2025-12");
    });
  });

  it("bakuCivilUtcDate is UTC midnight of civil YMD, not Baku wall midnight", () => {
    const civil = bakuCivilUtcDate("2026-09-22");
    assert.equal(civil.toISOString(), "2026-09-22T00:00:00.000Z");
    const wall = bakuDayBounds("2026-09-22").start;
    assert.equal(wall.toISOString(), "2026-09-21T20:00:00.000Z");
    assert.notEqual(civil.getTime(), wall.getTime());
  });

  it("bakuHourMinute returns Baku wall hour and minute", () => {
    withTz("UTC", () => {
      assert.deepEqual(bakuHourMinute("2026-09-21T20:30:00.000Z"), { hour: 0, minute: 30 });
      assert.deepEqual(bakuHourMinute("2026-09-22T04:00:00.000Z"), { hour: 8, minute: 0 });
    });
  });

  it("addBakuDays shifts civil YMD in Baku calendar", () => {
    withTz("UTC", () => {
      assert.equal(addBakuDays("2026-09-22", 1), "2026-09-23");
      assert.equal(addBakuDays("2026-09-22", -1), "2026-09-21");
    });
  });

  it("computeTrialExpiresEndOfMonthBaku ends last day of reg+months", () => {
    withTz("UTC", () => {
      const end = computeTrialExpiresEndOfMonthBaku(new Date("2026-06-10T10:00:00.000Z"), 3);
      assert.equal(bakuDateKey(end), "2026-09-30");
      assert.equal(bakuTimeLabel(end), "23:59");
      const legacy = computeTrialExpiresAtBaku(new Date("2026-06-10T10:00:00.000Z"), 3);
      assert.equal(bakuDateKey(legacy), "2026-09-10");
    });
  });

  it("display labels use Baku wall clock", () => {
    const d = new Date("2026-08-28T14:36:00.000Z");
    assert.equal(bakuDateDisplay(d), "28.08.2026");
    assert.equal(bakuDateTimeLabel(d), "28.08 18:36");
    assert.equal(bakuDateTimeDisplay(d), "28.08.2026 18:36");
  });

  it("rejects invalid YMD / time", () => {
    assert.throws(() => bakuDayBounds("22-09-2026"));
    assert.throws(() => bakuCivilUtcDate("2026/09/22"));
    assert.throws(() => parseBakuDateTime("2026-08-28", "18"));
  });
});
