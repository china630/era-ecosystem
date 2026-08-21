import {
  inferStaffKind,
  isAbsentOnYmd,
  previousYearMonth,
  resolveDutyCandidates,
  yearMonthOfYmd,
} from "@/domain/staff/staff-kind";

describe("staff kind + monthly duty roster", () => {
  it("infers nurse / lab / doctor from role and specialty", () => {
    expect(inferStaffKind({ role: "NURSE" })).toBe("NURSE");
    expect(inferStaffKind({ role: "LAB_TECH" })).toBe("LAB");
    expect(inferStaffKind({ specialty: "Senior nurse", code: "NR-01" })).toBe("NURSE");
    expect(inferStaffKind({ specialty: "LAB", code: "LAB-01" })).toBe("LAB");
    expect(inferStaffKind({ specialty: "Therapist", code: "DR-01" })).toBe("DOCTOR");
  });

  it("computes previous year-month across year boundary", () => {
    expect(yearMonthOfYmd("2026-08-17")).toBe("2026-08");
    expect(previousYearMonth("2026-01")).toBe("2025-12");
    expect(previousYearMonth("2026-08")).toBe("2026-07");
  });

  it("treats absence windows as inclusive date-only", () => {
    const windows = [
      { startsOn: new Date("2026-08-10T00:00:00.000Z"), endsOn: new Date("2026-08-20T00:00:00.000Z") },
    ];
    expect(isAbsentOnYmd(windows, "2026-08-10")).toBe(true);
    expect(isAbsentOnYmd(windows, "2026-08-20")).toBe(true);
    expect(isAbsentOnYmd(windows, "2026-08-21")).toBe(false);
  });

  it("does not restrict the pool when roster is draft or missing", () => {
    const skilled = [
      { id: "n1", fullName: "Amina", code: "NR-01" },
      { id: "n2", fullName: "Maya", code: "NR-02" },
    ];
    expect(
      resolveDutyCandidates({
        rosterStatus: null,
        postedPractitionerId: "n1",
        postedAbsent: false,
        skilled,
      }).map((p) => p.id),
    ).toEqual(["n1", "n2"]);
    expect(
      resolveDutyCandidates({
        rosterStatus: "DRAFT",
        postedPractitionerId: "n1",
        postedAbsent: false,
        skilled,
      }).map((p) => p.id),
    ).toEqual(["n1", "n2"]);
  });

  it("restricts to the posted nurse when approved and present", () => {
    const skilled = [
      { id: "n1", fullName: "Amina", code: "NR-01" },
      { id: "n2", fullName: "Maya", code: "NR-02" },
    ];
    expect(
      resolveDutyCandidates({
        rosterStatus: "APPROVED",
        postedPractitionerId: "n1",
        postedAbsent: false,
        skilled,
      }).map((p) => p.id),
    ).toEqual(["n1"]);
  });

  it("falls back to the skilled pool when the posted nurse is absent", () => {
    const skilled = [
      { id: "n1", fullName: "Amina", code: "NR-01" },
      { id: "n2", fullName: "Maya", code: "NR-02" },
    ];
    expect(
      resolveDutyCandidates({
        rosterStatus: "APPROVED",
        postedPractitionerId: "n1",
        postedAbsent: true,
        skilled,
      }).map((p) => p.id),
    ).toEqual(["n2"]);
  });

  it("keeps a posted nurse even without a recorded skill (head-doctor override)", () => {
    const skilled = [{ id: "n2", fullName: "Maya", code: "NR-02" }];
    expect(
      resolveDutyCandidates({
        rosterStatus: "APPROVED",
        postedPractitionerId: "n1",
        posted: { id: "n1", fullName: "Amina", code: "NR-01" },
        postedAbsent: false,
        skilled,
      }).map((p) => p.id),
    ).toEqual(["n1"]);
  });
});
