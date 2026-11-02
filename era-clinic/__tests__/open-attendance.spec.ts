import {
  isOpenSchedulingMode,
  isWithinClinicDayHours,
  noteOpenAttendanceDay,
  openAttendanceBurnsQuota,
  orderCountsForWallClockRest,
  orderIsTodayBaku,
  pickOpenAttendanceDay,
} from "@/domain/procedure/open-attendance";
import { parseBakuDateTime } from "@/lib/baku-day";

describe("open attendance helpers (CLI-62)", () => {
  it("detects OPEN mode", () => {
    expect(isOpenSchedulingMode("OPEN")).toBe(true);
    expect(isOpenSchedulingMode("FIXED")).toBe(false);
    expect(isOpenSchedulingMode(null)).toBe(false);
  });

  it("OPEN unseated day-bucket does not count for wall-clock rest", () => {
    expect(
      orderCountsForWallClockRest({
        status: "SCHEDULED",
        schedulingMode: "OPEN",
        resourceId: null,
      }),
    ).toBe(false);
    expect(
      orderCountsForWallClockRest({
        status: "SCHEDULED",
        schedulingMode: "OPEN",
        resourceId: "cabin-1",
      }),
    ).toBe(true);
    expect(
      orderCountsForWallClockRest({
        status: "SCHEDULED",
        schedulingMode: "FIXED",
        resourceId: "cabin-1",
      }),
    ).toBe(true);
    expect(
      orderCountsForWallClockRest({
        status: "PROPOSED",
        schedulingMode: "FIXED",
        resourceId: null,
      }),
    ).toBe(false);
  });

  it("burns quota only after attendance for OPEN", () => {
    expect(openAttendanceBurnsQuota("SCHEDULED")).toBe(false);
    expect(openAttendanceBurnsQuota("NO_SHOW")).toBe(false);
    expect(openAttendanceBurnsQuota("CHECKED_IN")).toBe(true);
    expect(openAttendanceBurnsQuota("COMPLETED")).toBe(true);
  });

  it("clinic day hours are half-open [start, end)", () => {
    const mid = parseBakuDateTime("2026-10-28", "12:00");
    const early = parseBakuDateTime("2026-10-28", "08:00");
    const end = parseBakuDateTime("2026-10-28", "18:00");
    expect(isWithinClinicDayHours(mid, 9, 18)).toBe(true);
    expect(isWithinClinicDayHours(early, 9, 18)).toBe(false);
    expect(isWithinClinicDayHours(end, 9, 18)).toBe(false);
  });

  const days = ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-06"];

  function blank() {
    return {
      codesOnDay: new Map<string, Set<string>>(),
      packageCodesOnDay: new Map<string, Map<string, Set<string>>>(),
    };
  }

  it("shares one day across different extra codes and moves a repeat to the next working day", () => {
    const book = blank();
    const base = {
      inPackage: false,
      quotaKey: "X",
      dailyCap: null as number | null,
      startYmd: "2026-11-02",
      horizonEndYmd: "2026-11-06",
      workingYmds: days,
      ...book,
    };
    const first = pickOpenAttendanceDay({ ...base, procedureCode: "A" });
    noteOpenAttendanceDay(book.codesOnDay, book.packageCodesOnDay, first!, "A", false, "X");
    const other = pickOpenAttendanceDay({ ...base, procedureCode: "B" });
    noteOpenAttendanceDay(book.codesOnDay, book.packageCodesOnDay, other!, "B", false, "X");
    const repeat = pickOpenAttendanceDay({ ...base, procedureCode: "A" });
    expect(first).toBe("2026-11-02");
    expect(other).toBe("2026-11-02");
    expect(repeat).toBe("2026-11-03");
  });

  it("skips a closed day already absent from workingYmds", () => {
    const book = blank();
    for (const ymd of ["2026-11-02", "2026-11-03", "2026-11-04"]) {
      noteOpenAttendanceDay(book.codesOnDay, book.packageCodesOnDay, ymd, "A", false, "A");
    }
    const next = pickOpenAttendanceDay({
      procedureCode: "A",
      inPackage: false,
      quotaKey: "A",
      dailyCap: null,
      startYmd: "2026-11-02",
      horizonEndYmd: "2026-11-06",
      workingYmds: days,
      ...book,
    });
    expect(next).toBe("2026-11-06");
  });

  it("returns null when the stay has no free day left for that code", () => {
    const book = blank();
    for (const ymd of days) {
      noteOpenAttendanceDay(book.codesOnDay, book.packageCodesOnDay, ymd, "A", false, "A");
    }
    expect(
      pickOpenAttendanceDay({
        procedureCode: "A",
        inPackage: false,
        quotaKey: "A",
        dailyCap: null,
        startYmd: "2026-11-02",
        horizonEndYmd: "2026-11-06",
        workingYmds: days,
        ...book,
      }),
    ).toBeNull();
  });

  it("keeps an in-package block inside its distinct-code cap and still seats a paid extra", () => {
    const book = blank();
    const day = pickOpenAttendanceDay({
      procedureCode: "PHY-A",
      inPackage: true,
      quotaKey: "PHYSIO",
      dailyCap: 1,
      startYmd: "2026-11-02",
      horizonEndYmd: "2026-11-06",
      workingYmds: days,
      ...book,
    });
    noteOpenAttendanceDay(book.codesOnDay, book.packageCodesOnDay, day!, "PHY-A", true, "PHYSIO");
    const secondPackage = pickOpenAttendanceDay({
      procedureCode: "PHY-B",
      inPackage: true,
      quotaKey: "PHYSIO",
      dailyCap: 1,
      startYmd: "2026-11-02",
      horizonEndYmd: "2026-11-06",
      workingYmds: days,
      ...book,
    });
    const extra = pickOpenAttendanceDay({
      procedureCode: "PHY-C",
      inPackage: false,
      quotaKey: "PHY-C",
      dailyCap: null,
      startYmd: "2026-11-02",
      horizonEndYmd: "2026-11-06",
      workingYmds: days,
      ...book,
    });
    expect(day).toBe("2026-11-02");
    expect(secondPackage).toBe("2026-11-03");
    expect(extra).toBe("2026-11-02");
  });

  it("orderIsTodayBaku compares calendar days", () => {
    const noon = parseBakuDateTime("2026-10-28", "12:00");
    const other = parseBakuDateTime("2026-10-27", "12:00");
    expect(orderIsTodayBaku(noon, noon)).toBe(true);
    expect(orderIsTodayBaku(other, noon)).toBe(false);
  });
});
