import { day1ProgramToast } from "@/lib/day1-program-toast";

describe("day1ProgramToast", () => {
  it("success opens day-1 package", () => {
    expect(day1ProgramToast({ opened: true, programCode: "PKG-STANDART" })).toEqual({
      tone: "success",
      key: "day1ProgramOpened",
    });
  });

  it("surfaces nights below package minimum", () => {
    expect(
      day1ProgramToast({
        opened: false,
        reason: "PACKAGE_NIGHTS_BELOW_MIN",
        programCode: "PKG-STANDART",
        nights: 3,
        minNights: 5,
      }),
    ).toEqual({
      tone: "error",
      key: "day1PackageNightsBelowMin",
      values: { code: "PKG-STANDART", nights: 3, minNights: 5 },
    });
  });

  it("surfaces missing template separately from generic instantiate failure", () => {
    expect(
      day1ProgramToast({
        opened: false,
        reason: "TEMPLATE_NOT_FOUND",
        programCode: "PKG-DERMA",
      }),
    ).toEqual({
      tone: "error",
      key: "day1TemplateNotFound",
      values: { code: "PKG-DERMA" },
    });
    expect(
      day1ProgramToast({ opened: false, reason: "INSTANTIATE_FAILED" }),
    ).toEqual({ tone: "error", key: "day1InstantiateFailed" });
  });

  it("stays silent for incomplete clinical gates", () => {
    expect(day1ProgramToast({ opened: false, reason: "NO_ANAMNESIS" })).toBeNull();
    expect(day1ProgramToast({ opened: false, reason: "NO_CARE_TEAM" })).toBeNull();
  });
});
