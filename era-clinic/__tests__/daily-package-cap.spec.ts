import {
  DEFAULT_DAILY_PACKAGE_PROCEDURE_CAP,
  inPackageCodesOnBakuDay,
  packageDayIsFullForNewCode,
} from "@/domain/sanatorium/daily-package-cap";

describe("daily package procedure cap", () => {
  const day = new Date("2026-09-09T10:00:00+04:00");

  it("defaults to 3 distinct in-package codes per Baku day", () => {
    const slots = [
      { code: "NAFTALAN", start: day, inPackage: true },
      { code: "PARAFFIN", start: day, inPackage: true },
      { code: "OZONE", start: day, inPackage: true },
      { code: "EXTRA-MASSAGE", start: day, inPackage: false },
    ];
    const codes = inPackageCodesOnBakuDay(slots, day);
    expect(codes.size).toBe(3);
    expect(
      packageDayIsFullForNewCode(codes, "AMPLIPULSE", DEFAULT_DAILY_PACKAGE_PROCEDURE_CAP),
    ).toBe(true);
    expect(packageDayIsFullForNewCode(codes, "OZONE", 3)).toBe(false);
  });

  it("does not count paid extras toward the package cap", () => {
    const slots = [
      { code: "NAFTALAN", start: day, inPackage: true },
      { code: "EXTRA-A", start: day, inPackage: false },
      { code: "EXTRA-B", start: day, inPackage: false },
    ];
    const codes = inPackageCodesOnBakuDay(slots, day);
    expect(
      packageDayIsFullForNewCode(codes, "PARAFFIN", DEFAULT_DAILY_PACKAGE_PROCEDURE_CAP),
    ).toBe(false);
  });
});
