import { nextWorkingYmd, type ClinicDay } from "@/domain/planning/clinic-day";

function day(ymd: string, working: boolean): ClinicDay {
  return { ymd, working, endHour: working ? 17 : 0 };
}

describe("nextWorkingYmd", () => {
  const week = [
    day("2026-10-17", true),
    day("2026-10-18", false),
    day("2026-10-19", true),
  ];

  it("leaves an already working day", () => {
    expect(nextWorkingYmd(week, "2026-10-17")).toBe("2026-10-17");
  });

  it("moves Sunday to Monday", () => {
    expect(nextWorkingYmd(week, "2026-10-18")).toBe("2026-10-19");
  });

  it("returns null when the stay has no later working day", () => {
    expect(nextWorkingYmd([day("2026-10-18", false)], "2026-10-18")).toBeNull();
  });
});
