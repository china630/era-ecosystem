import {
  monthHourNorm,
  summarizeCalendar,
  weeklyHoursForRegime,
} from "./workforce-calendar-norm";
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
