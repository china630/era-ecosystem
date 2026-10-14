import {
  monthHourNorm,
  nextPlannedPayDate,
  resolveRegimeHours,
  summarizeCalendar,
  weeklyHoursForRegime,
  workYearContaining,
} from "./workforce-calendar-norm";
import { stepApplies } from "./workforce-approval.resolve";
import { resolveRequesterManager } from "./workforce-approval.resolve";

describe("workforce calendar norm", () => {
  it("counts a hub holiday separately from a weekend fallback", () => {
    const summary = summarizeCalendar(2026, 10, [
      { date: "2026-10-18", dayType: "holiday", isWorking: false },
      { date: "2026-10-19", dayType: "working", isWorking: true },
    ]);
    expect(summary.holidays).toBe(1);
    expect(summary.days).toHaveLength(31);
    const oct18 = summary.days.find((d) => d.date === "2026-10-18");
    expect(oct18?.isWorking).toBe(false);
    expect(summary.workDays).toBeGreaterThan(0);
    expect(summary.offDays).toBe(summary.days.length - summary.workDays);
  });

  it("returns null hour norm until weekly hours are set", () => {
    const days = summarizeCalendar(2026, 10, []).days;
    expect(monthHourNorm("FIVE_DAY", null, days)).toBeNull();
    expect(weeklyHoursForRegime("MEDICAL", { medicalWeeklyHours: null })).toBeNull();
    const norm = monthHourNorm("FIVE_DAY", 40, days);
    expect(norm).not.toBeNull();
    expect(norm!).toBeGreaterThan(0);
  });

  it("does not invent a regime, and prefers position hours", () => {
    expect(
      resolveRegimeHours({
        employmentRegime: null,
        positionRegime: null,
        positionWeeklyHours: 40,
        org: { fiveDayWeeklyHours: 40 },
      }).regime,
    ).toBeNull();
    const resolved = resolveRegimeHours({
      employmentRegime: "SIX_DAY",
      positionRegime: "FIVE_DAY",
      positionWeeklyHours: 36,
      org: { sixDayWeeklyHours: 40 },
    });
    expect(resolved).toEqual({ regime: "SIX_DAY", weeklyHours: 36 });
  });

  it("labels the hire-date work year that contains the start", () => {
    expect(workYearContaining("2020-03-15", "2026-03-14")).toEqual({
      from: "2025-03-15",
      to: "2026-03-14",
    });
    expect(workYearContaining("2020-03-15", "2026-03-15")).toEqual({
      from: "2026-03-15",
      to: "2027-03-14",
    });
  });

  it("moves a non-working pay day to the previous working day", () => {
    expect(
      nextPlannedPayDate("2026-10-01", 18, [
        { date: "2026-10-18", dayType: "holiday", isWorking: false },
        { date: "2026-10-17", dayType: "weekend", isWorking: false },
      ]),
    ).toBe("2026-10-16");
  });

  it("skips leadership-only steps for an ordinary position", () => {
    expect(stepApplies("LEADERSHIP", false)).toBe(false);
    expect(stepApplies("ORDINARY", false)).toBe(true);
    expect(stepApplies("ALWAYS", true)).toBe(true);
  });
});

describe("workforce approval resolve", () => {
  const units = [
    {
      id: "root",
      parentId: null,
      name: "Direktorluq",
      managerEmploymentId: "dir",
      managerUserId: null,
    },
    {
      id: "hr",
      parentId: "root",
      name: "Kadrlar",
      managerEmploymentId: "hr-head",
      managerUserId: null,
    },
    {
      id: "ward",
      parentId: "hr",
      name: "Şöbə",
      managerEmploymentId: "self",
      managerUserId: null,
    },
  ];

  it("walks past the requester to the parent manager", () => {
    const hit = resolveRequesterManager({
      startOrgUnitId: "ward",
      requesterEmploymentId: "self",
      units,
    });
    expect(hit).toEqual({
      employmentId: "hr-head",
      userId: null,
      orgUnitId: "hr",
      orgUnitName: "Kadrlar",
    });
  });
});
