import {
  isOpenSchedulingMode,
  isWithinClinicDayHours,
  openAttendanceBurnsQuota,
  orderIsTodayBaku,
} from "@/domain/procedure/open-attendance";
import { parseBakuDateTime } from "@/lib/baku-day";

describe("open attendance helpers (CLI-62)", () => {
  it("detects OPEN mode", () => {
    expect(isOpenSchedulingMode("OPEN")).toBe(true);
    expect(isOpenSchedulingMode("FIXED")).toBe(false);
    expect(isOpenSchedulingMode(null)).toBe(false);
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

  it("orderIsTodayBaku compares calendar days", () => {
    const noon = parseBakuDateTime("2026-10-28", "12:00");
    const other = parseBakuDateTime("2026-10-27", "12:00");
    expect(orderIsTodayBaku(noon, noon)).toBe(true);
    expect(orderIsTodayBaku(other, noon)).toBe(false);
  });
});
