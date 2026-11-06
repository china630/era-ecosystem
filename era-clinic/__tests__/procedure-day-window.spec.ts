import {
  findPeakOverlap,
  peakDateRangesOverlap,
  resolveGridAxis,
  resolveProcedureDayWindow,
  type DayBoundary,
  type PeakRule,
} from "@/domain/planning/procedure-day-window";

const workingDay = (ymd: string, start = 9, end = 18): DayBoundary => ({
  ymd,
  kind: "working",
  startHour: start,
  endHour: end,
});

const shortDay = (ymd: string, start = 9, end = 13): DayBoundary => ({
  ymd,
  kind: "short",
  startHour: start,
  endHour: end,
});

describe("procedure-day-window", () => {
  it("keeps staff hours when journal is empty and peak mode is off", () => {
    const win = resolveProcedureDayWindow({
      day: workingDay("2026-11-05"),
      peaks: [],
      procedure: { extendedEndHour: 19 },
      peakModeEnabled: false,
    });
    expect(win.startHour).toBe(9);
    expect(win.endHour).toBe(18);
  });

  it("legacy peakMode applies OWN_ONLY on working days without a journal row", () => {
    const win = resolveProcedureDayWindow({
      day: workingDay("2026-11-05"),
      peaks: [],
      procedure: { extendedEndHour: 19 },
      peakModeEnabled: true,
    });
    expect(win.endHour).toBe(19);
  });

  it("legacy peakMode does not stretch short days from a working card", () => {
    const win = resolveProcedureDayWindow({
      day: shortDay("2026-11-07"),
      peaks: [],
      procedure: { extendedEndHour: 19 },
      peakModeEnabled: true,
    });
    expect(win.endHour).toBe(13);
  });

  it("OWN_ONLY extends only procedures with a card hour", () => {
    const peak: PeakRule = {
      fromYmd: "2026-11-01",
      toYmd: "2026-11-13",
      dayKind: "WORKING",
      scope: "OWN_ONLY",
      startHour: null,
      endHour: null,
    };
    const massage = resolveProcedureDayWindow({
      day: workingDay("2026-11-05"),
      peaks: [peak],
      procedure: { extendedEndHour: 19 },
    });
    const laser = resolveProcedureDayWindow({
      day: workingDay("2026-11-05"),
      peaks: [peak],
      procedure: {},
    });
    expect(massage.endHour).toBe(19);
    expect(laser.endHour).toBe(18);
  });

  it("EMPTY_DEFAULT fills empty cards and keeps own card hours", () => {
    const peak: PeakRule = {
      fromYmd: "2026-11-01",
      toYmd: "2026-11-13",
      dayKind: "WORKING",
      scope: "EMPTY_DEFAULT",
      startHour: 8,
      endHour: 20,
    };
    const empty = resolveProcedureDayWindow({
      day: workingDay("2026-11-05"),
      peaks: [peak],
      procedure: {},
    });
    const own = resolveProcedureDayWindow({
      day: workingDay("2026-11-05"),
      peaks: [peak],
      procedure: { extendedEndHour: 19, extendedStartHour: 7 },
    });
    expect(empty.startHour).toBe(8);
    expect(empty.endHour).toBe(20);
    expect(own.startHour).toBe(7);
    expect(own.endHour).toBe(19);
  });

  it("CLINIC_WIDE ignores cards", () => {
    const peak: PeakRule = {
      fromYmd: "2026-11-01",
      toYmd: "2026-11-13",
      dayKind: "WORKING",
      scope: "CLINIC_WIDE",
      startHour: 8,
      endHour: 21,
    };
    const win = resolveProcedureDayWindow({
      day: workingDay("2026-11-05"),
      peaks: [peak],
      procedure: { extendedEndHour: 19 },
    });
    expect(win.startHour).toBe(8);
    expect(win.endHour).toBe(21);
  });

  it("working peak does not apply on a short day", () => {
    const peak: PeakRule = {
      fromYmd: "2026-11-01",
      toYmd: "2026-11-13",
      dayKind: "WORKING",
      scope: "OWN_ONLY",
      startHour: null,
      endHour: null,
    };
    const win = resolveProcedureDayWindow({
      day: shortDay("2026-11-07"),
      peaks: [peak],
      procedure: { extendedEndHour: 19 },
      peakModeEnabled: true,
    });
    expect(win.endHour).toBe(13);
  });

  it("peak cannot open a closed day", () => {
    const peak: PeakRule = {
      fromYmd: "2026-11-01",
      toYmd: "2026-11-13",
      dayKind: "WORKING",
      scope: "CLINIC_WIDE",
      startHour: 8,
      endHour: 21,
    };
    const win = resolveProcedureDayWindow({
      day: { ymd: "2026-11-08", kind: "closed", startHour: 0, endHour: 0 },
      peaks: [peak],
      procedure: { extendedEndHour: 19 },
      peakModeEnabled: true,
    });
    expect(win.closed).toBe(true);
    expect(win.endHour).toBe(0);
  });

  it("refuses overlapping peak rows of the same day kind", () => {
    const existing: PeakRule[] = [
      {
        id: "a",
        fromYmd: "2026-11-01",
        toYmd: "2026-11-10",
        dayKind: "WORKING",
        scope: "OWN_ONLY",
        startHour: null,
        endHour: null,
      },
    ];
    expect(
      findPeakOverlap(existing, {
        fromYmd: "2026-11-08",
        toYmd: "2026-11-15",
        dayKind: "WORKING",
        scope: "EMPTY_DEFAULT",
        startHour: 8,
        endHour: 20,
      })?.id,
    ).toBe("a");
    expect(
      findPeakOverlap(existing, {
        fromYmd: "2026-11-08",
        toYmd: "2026-11-15",
        dayKind: "SHORT",
        scope: "OWN_ONLY",
        startHour: null,
        endHour: null,
      }),
    ).toBeNull();
    expect(peakDateRangesOverlap("2026-11-01", "2026-11-05", "2026-11-06", "2026-11-10")).toBe(
      false,
    );
  });

  it("grid axis spans the earliest start and latest end", () => {
    const day = workingDay("2026-11-05");
    const axis = resolveGridAxis(day, [
      resolveProcedureDayWindow({
        day,
        peaks: [],
        procedure: { extendedEndHour: 19 },
        peakModeEnabled: true,
      }),
      resolveProcedureDayWindow({
        day,
        peaks: [],
        procedure: { extendedStartHour: 7 },
        peakModeEnabled: true,
      }),
    ]);
    expect(axis.startHour).toBe(7);
    expect(axis.endHour).toBe(19);
  });
});
