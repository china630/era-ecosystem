import {
  inferStaffKind,
  isAbsentOnYmd,
  planRosterStaffReassignment,
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

  it("does not silently fall back when the posted nurse is absent (CLI-38b)", () => {
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
    ).toEqual([]);
  });

  it("returns empty when approved roster has no posted nurse and no override", () => {
    const skilled = [
      { id: "n1", fullName: "Amina", code: "NR-01" },
      { id: "n2", fullName: "Maya", code: "NR-02" },
    ];
    expect(
      resolveDutyCandidates({
        rosterStatus: "APPROVED",
        postedPractitionerId: null,
        postedAbsent: false,
        skilled,
      }).map((p) => p.id),
    ).toEqual([]);
  });

  it("prefers an explicit day override over the posted nurse", () => {
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
        dayOverridePractitionerId: "n2",
      }).map((p) => p.id),
    ).toEqual(["n2"]);
  });

  it("uses day override when the posted nurse is absent", () => {
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
        dayOverridePractitionerId: "n2",
        dayOverride: { id: "n2", fullName: "Maya", code: "NR-02" },
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

describe("approve reassigns future staff onto the posted nurse", () => {
  const slot = (
    allocationId: string,
    startsAt: string,
    staffMode: "HARD" | "SOFT" = "SOFT",
  ) => ({
    allocationId,
    procedureTypeId: "ampli",
    startsAt: new Date(startsAt),
    endsAt: new Date(new Date(startsAt).getTime() + 15 * 60_000),
    staffMode,
    ymd: "2026-11-02",
  });

  it("puts the monthly post on each future slot and keeps a day override", () => {
    const planned = planRosterStaffReassignment({
      slots: [slot("a1", "2026-11-02T06:00:00.000Z"), slot("a2", "2026-11-02T08:00:00.000Z")],
      occupations: [],
      posts: [{ procedureTypeId: "ampli", practitionerId: "n-oct" }],
      overrides: [{ procedureTypeId: "ampli", ymd: "2026-11-02", practitionerId: "n-sub" }],
      absent: () => false,
    });
    expect(planned.map((row) => row.practitionerId)).toEqual(["n-sub", "n-sub"]);
  });

  it("clears a HARD slot when the posted nurse is already on another procedure", () => {
    const planned = planRosterStaffReassignment({
      slots: [
        slot("early", "2026-11-02T06:00:00.000Z", "HARD"),
        slot("late", "2026-11-02T06:05:00.000Z", "HARD"),
      ],
      occupations: [
        {
          practitionerId: "n1",
          startsAt: new Date("2026-11-02T06:00:00.000Z"),
          endsAt: new Date("2026-11-02T06:20:00.000Z"),
          staffMode: "SOFT",
        },
      ],
      posts: [{ procedureTypeId: "ampli", practitionerId: "n1" }],
      overrides: [],
      absent: () => false,
    });
    expect(planned.map((row) => row.practitionerId)).toEqual([null, null]);
  });

  it("keeps the earlier HARD slot and leaves the overlapping one empty", () => {
    const planned = planRosterStaffReassignment({
      slots: [
        slot("early", "2026-11-02T06:00:00.000Z", "HARD"),
        slot("late", "2026-11-02T06:05:00.000Z", "HARD"),
      ],
      occupations: [],
      posts: [{ procedureTypeId: "ampli", practitionerId: "n1" }],
      overrides: [],
      absent: () => false,
    });
    expect(planned.map((row) => [row.allocationId, row.practitionerId])).toEqual([
      ["early", "n1"],
      ["late", null],
    ]);
  });

  it("does not give an absent posted nurse the slot", () => {
    const planned = planRosterStaffReassignment({
      slots: [slot("a1", "2026-11-02T06:00:00.000Z")],
      occupations: [],
      posts: [{ procedureTypeId: "ampli", practitionerId: "n1" }],
      overrides: [],
      absent: (id) => id === "n1",
    });
    expect(planned[0]?.practitionerId).toBeNull();
  });
});
