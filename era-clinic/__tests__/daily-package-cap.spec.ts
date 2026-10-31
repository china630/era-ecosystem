import {
  DEFAULT_DAILY_PACKAGE_PROCEDURE_CAP,
  inPackageCodesOnBakuDay,
  capsByBlock,
  packageBlockIsFull,
  packageDayIsFullForNewCode,
} from "@/domain/sanatorium/daily-package-cap";
import { transferQuotaCode, capBlockOfQuota } from "@/domain/sanatorium/package-assign-quota";

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
      packageDayIsFullForNewCode(codes, "AMPLIPULSE", 3),
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
      packageDayIsFullForNewCode(codes, "PARAFFIN", 3),
    ).toBe(false);
  });
});

describe("package block daily cap", () => {
  const day = new Date("2026-10-19T05:00:00.000Z");

  it("fills the bath block and leaves physio open", () => {
    const slots = [
      { code: "SVC-NAFTALAN-VANNASI-QADIN", start: day, inPackage: true, quotaKey: "NAFTALAN" },
    ];
    expect(
      packageBlockIsFull({
        slots,
        day,
        candidateCode: "SVC-PHYSIO",
        quotaKey: "PHYSIO_POOL",
        cap: 3,
      }),
    ).toBe(false);
    expect(
      packageBlockIsFull({ slots, day, candidateCode: "SVC-BATH-2", quotaKey: "NAFTALAN", cap: 1 }),
    ).toBe(true);
    expect(
      packageBlockIsFull({
        slots,
        day,
        candidateCode: "SVC-NAFTALAN-VANNASI-QADIN",
        quotaKey: "NAFTALAN",
        cap: 1,
      }),
    ).toBe(false);
  });

  it("empty stored cap is one distinct procedure, whatever the block kind", () => {
    const caps = capsByBlock([
      { procedureCode: "PHYSIO_POOL", kind: "PHYSIO", dailyDistinctCap: null },
      { procedureCode: "PARAFFIN_POOL", dailyDistinctCap: null },
      { procedureCode: "NAFTALAN", dailyDistinctCap: null },
      { procedureCode: "SVC_MASAJ_POOL", kind: "CUSTOM", dailyDistinctCap: null },
    ]);
    expect(caps.get("PHYSIO_POOL")).toBe(1);
    expect(caps.get("PARAFFIN_POOL")).toBe(1);
    expect(caps.get("NAFTALAN")).toBe(1);
    expect(caps.get("SVC_MASAJ_POOL")).toBe(1);
  });

  it("uses the number stored on the block", () => {
    const caps = capsByBlock([
      { procedureCode: "PHYSIO_POOL", kind: "PHYSIO", dailyDistinctCap: 3 },
    ]);
    expect(caps.get("PHYSIO_POOL")).toBe(3);
  });

  it("charges a physio replacement against the bath predecessor", () => {
    const code = transferQuotaCode("NAFTALAN", "SVC-AMPLIPULSE");
    expect(capBlockOfQuota(code, new Map())).toBe("NAFTALAN");
    const slots = [
      { code: "SVC-AMPLIPULSE", start: day, inPackage: true, quotaKey: "NAFTALAN" },
    ];
    expect(
      packageBlockIsFull({ slots, day, candidateCode: "SVC-MAGNET", quotaKey: "NAFTALAN", cap: 1 }),
    ).toBe(true);
  });
});
