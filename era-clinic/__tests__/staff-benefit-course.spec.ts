import {
  filterWorkforcePicker,
  type WorkforcePickerItem,
} from "@/lib/workforce-picker";
import {
  StaffBenefitCourseError,
  assertStaffBenefitProgramAllowed,
  requireCpEmploymentId,
  validateStaffBenefitCourseDays,
} from "@/domain/sanatorium/staff-benefit-course.service";
import {
  CourseWindowError,
  assertCourseWindowNotHotelOwned,
  parseCourseWindowEndsOnYmd,
} from "@/domain/sanatorium/course-window.service";
import { coalesceScheduleBefore } from "@/domain/sanatorium/episode-schedule-horizon";

describe("workforce picker filter", () => {
  const items: WorkforcePickerItem[] = [
    {
      id: "emp-1",
      globalPersonId: "gp-1",
      name: "Aliyev Orxan",
      orgUnitId: "u1",
      orgUnitName: "Med Block",
      positionId: "p1",
      positionName: "Therapist",
      leadership: false,
    },
    {
      id: "emp-2",
      globalPersonId: "gp-2",
      name: "Mammadova Aysel",
      orgUnitId: "u2",
      orgUnitName: "Housekeeping",
      positionId: "p2",
      positionName: "Cleaner",
      leadership: false,
    },
  ];

  it("filters by name and unit", () => {
    expect(filterWorkforcePicker(items, "orxan")).toHaveLength(1);
    expect(filterWorkforcePicker(items, "house")).toHaveLength(1);
    expect(filterWorkforcePicker(items, "")).toHaveLength(2);
  });
});

describe("hidePackage rule (CLI-69)", () => {
  function hidePackage(patientOrigin: string, hasPackageInstance: boolean) {
    return patientOrigin === "WALK_IN" && !hasPackageInstance;
  }

  it("hides for ambulatory without ProgramInstance", () => {
    expect(hidePackage("WALK_IN", false)).toBe(true);
  });

  it("shows for staff benefit with ProgramInstance", () => {
    expect(hidePackage("WALK_IN", true)).toBe(false);
  });

  it("shows for in-house even without instance yet", () => {
    expect(hidePackage("IN_HOUSE", false)).toBe(false);
  });
});

describe("staff benefit input guards", () => {
  it("requires cpEmploymentId", () => {
    expect(() => requireCpEmploymentId("  ")).toThrow(StaffBenefitCourseError);
    try {
      requireCpEmploymentId("");
    } catch (err) {
      expect(err).toMatchObject({ code: "EMPLOYMENT_REQUIRED", status: 400 });
    }
  });

  it("rejects courseDays outside 1…31", () => {
    expect(() => validateStaffBenefitCourseDays(0)).toThrow(StaffBenefitCourseError);
    expect(() => validateStaffBenefitCourseDays(32)).toThrow(StaffBenefitCourseError);
    expect(validateStaffBenefitCourseDays(10)).toBe(10);
  });

  it("allows only PKG-STANDART", () => {
    expect(assertStaffBenefitProgramAllowed("pkg-standart")).toBe("PKG-STANDART");
    expect(() => assertStaffBenefitProgramAllowed("PKG-PREMIUM")).toThrow(
      StaffBenefitCourseError,
    );
    try {
      assertStaffBenefitProgramAllowed("PKG-PREMIUM");
    } catch (err) {
      expect(err).toMatchObject({ code: "STAFF_PROGRAM_NOT_ALLOWED", status: 400 });
    }
  });
});

describe("course-window guards", () => {
  it("parses YYYY-MM-DD endsOn", () => {
    expect(parseCourseWindowEndsOnYmd("2026-12-01")).toBe("2026-12-01");
    expect(() => parseCourseWindowEndsOnYmd("01-12-2026")).toThrow(CourseWindowError);
  });

  it("refuses hotel-owned windows", () => {
    expect(() => assertCourseWindowNotHotelOwned("RES-1")).toThrow(CourseWindowError);
    try {
      assertCourseWindowNotHotelOwned("RES-1");
    } catch (err) {
      expect(err).toMatchObject({ code: "HOTEL_OWNED_WINDOW", status: 409 });
    }
    expect(() => assertCourseWindowNotHotelOwned(null)).not.toThrow();
  });
});

describe("schedule horizon coalesce", () => {
  it("prefers program instance endsOn over plannedEndsOn", () => {
    const instanceEnds = new Date("2026-11-20T09:00:00.000Z");
    const planned = new Date("2026-11-15T09:00:00.000Z");
    expect(coalesceScheduleBefore(instanceEnds, planned)).toBe(instanceEnds);
  });

  it("falls back to plannedEndsOn", () => {
    const planned = new Date("2026-11-15T09:00:00.000Z");
    expect(coalesceScheduleBefore(null, planned)).toBe(planned);
  });

  it("returns null when neither is set", () => {
    expect(coalesceScheduleBefore(null, null)).toBeNull();
  });
});
