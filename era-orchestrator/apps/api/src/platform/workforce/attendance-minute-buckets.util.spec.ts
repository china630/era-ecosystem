import {
  calendarKindFromDay,
  classifyMinuteBuckets,
  bakuWallToUtc,
  plannedWindowIntervals,
  subtractIntervals,
} from "./attendance-minute-buckets.util";

describe("attendance-minute-buckets.util", () => {
  const workYmd = "2026-09-16";

  it("subtracts break from presence", () => {
    const presence = [
      {
        start: bakuWallToUtc(workYmd, 9 * 60),
        end: bakuWallToUtc(workYmd, 18 * 60),
      },
    ];
    const breaks = [
      {
        start: bakuWallToUtc(workYmd, 12 * 60),
        end: bakuWallToUtc(workYmd, 13 * 60),
      },
    ];
    const buckets = classifyMinuteBuckets({
      presence,
      breaks,
      workYmd,
      startMinute: 9 * 60,
      endMinute: 18 * 60,
      plannedBreakMinutes: 60,
      calendarKind: "working",
      wasShiftDay: true,
    });
    // 9h window - 1h break = 8h = 480 normal; planned also 8h → shortfall 0
    expect(buckets.breakMinutes).toBe(60);
    expect(buckets.normalMinutes).toBe(480);
    expect(buckets.overtimeMinutes).toBe(0);
    expect(buckets.hours).toBe(8);
    expect(buckets.shortfallMinutes).toBe(0);
  });

  it("does not create overtime in hours when work extends past end", () => {
    const presence = [
      {
        start: bakuWallToUtc(workYmd, 9 * 60),
        end: bakuWallToUtc(workYmd, 20 * 60),
      },
    ];
    const buckets = classifyMinuteBuckets({
      presence,
      breaks: [],
      workYmd,
      startMinute: 9 * 60,
      endMinute: 18 * 60,
      plannedBreakMinutes: 0,
      calendarKind: "working",
      wasShiftDay: true,
    });
    expect(buckets.normalMinutes).toBe(9 * 60);
    expect(buckets.overtimeMinutes).toBe(2 * 60);
    expect(buckets.hours).toBe(9);
  });

  it("counts night intersection 22:00–06:00", () => {
    const presence = [
      {
        start: bakuWallToUtc(workYmd, 20 * 60),
        end: bakuWallToUtc("2026-09-17", 8 * 60),
      },
    ];
    const buckets = classifyMinuteBuckets({
      presence,
      breaks: [],
      workYmd,
      startMinute: 20 * 60,
      endMinute: 8 * 60,
      plannedBreakMinutes: 0,
      calendarKind: "working",
      wasShiftDay: true,
    });
    // 22:00–06:00 = 8h night
    expect(buckets.nightMinutes).toBe(8 * 60);
    expect(buckets.normalMinutes).toBe(12 * 60);
    expect(buckets.overtimeMinutes).toBe(0);
  });

  it("puts holiday presence in holidayMinutes not restDayMinutes", () => {
    const presence = [
      {
        start: bakuWallToUtc(workYmd, 9 * 60),
        end: bakuWallToUtc(workYmd, 17 * 60),
      },
    ];
    const buckets = classifyMinuteBuckets({
      presence,
      breaks: [],
      workYmd,
      startMinute: 9 * 60,
      endMinute: 18 * 60,
      plannedBreakMinutes: 0,
      calendarKind: "holiday",
      wasShiftDay: true,
    });
    expect(buckets.holidayMinutes).toBe(8 * 60);
    expect(buckets.restDayMinutes).toBe(0);
    expect(buckets.normalMinutes).toBe(0);
    expect(buckets.hours).toBe(0);
  });

  it("calendarKindFromDay prefers holiday over rest", () => {
    expect(
      calendarKindFromDay({ dayType: "holiday", isWorking: false }),
    ).toBe("holiday");
    expect(
      calendarKindFromDay({ dayType: "transferred_rest", isWorking: false }),
    ).toBe("rest");
  });

  it("open break alone yields empty presence after subtract helper", () => {
    const net = subtractIntervals([], [
      {
        start: bakuWallToUtc(workYmd, 12 * 60),
        end: bakuWallToUtc(workYmd, 12 * 60 + 30),
      },
    ]);
    expect(net).toEqual([]);
    expect(plannedWindowIntervals(workYmd, 540, 1080)).toHaveLength(1);
  });
});
