import {
  bakuDayKey,
  PackageAssignError,
  paramsLabelFromOrder,
  isPackagePoolCode,
  eligibleSkusForPool,
  isPackageAssignTreatmentLine,
  resolvePackageQuotaSku,
} from "@/domain/sanatorium/package-assign.service";
import { applyQuotaRecalc } from "@/lib/program-quota";
import { extraNeedsPaperTicket } from "@/domain/procedure/extra-ticket";

describe("CLI-57 package assign helpers", () => {
  it("bakuDayKey formats Asia/Baku calendar day", () => {
    // 2026-09-03 22:00 UTC = 2026-09-04 02:00 in Baku (UTC+4)
    const key = bakuDayKey(new Date("2026-09-03T22:00:00.000Z"));
    expect(key).toBe("2026-09-04");
  });

  it("PackageAssignError carries code and status", () => {
    const err = new PackageAssignError("quota", "QUOTA_EXCEEDED", 400);
    expect(err.code).toBe("QUOTA_EXCEEDED");
    expect(err.status).toBe(400);
  });

  it("isPackagePoolCode detects PHYSIO_POOL / PARAFFIN_POOL / *_POOL", () => {
    expect(isPackagePoolCode("PHYSIO_POOL")).toBe(true);
    expect(isPackagePoolCode("PARAFFIN_POOL")).toBe(true);
    expect(isPackagePoolCode("OTHER_POOL")).toBe(true);
    expect(isPackagePoolCode("SVC-OZONE")).toBe(false);
    expect(isPackagePoolCode("NAFTALAN")).toBe(false);
  });

  it("resolvePackageQuotaSku maps NAFTALAN_BATH by sex", () => {
    const types = ["SVC-NAFTALAN-VANNASI-KISI", "SVC-NAFTALAN-VANNASI-QADIN"];
    expect(resolvePackageQuotaSku("NAFTALAN_BATH", "MALE", types)).toBe(
      "SVC-NAFTALAN-VANNASI-KISI",
    );
    expect(resolvePackageQuotaSku("NAFTALAN_BATH", "FEMALE", types)).toBe(
      "SVC-NAFTALAN-VANNASI-QADIN",
    );
    expect(resolvePackageQuotaSku("SVC-OZONE", "MALE", types)).toBe(null);
  });

    expect(isPackageAssignTreatmentLine("PHYSIO_POOL")).toBe(false);
    expect(isPackageAssignTreatmentLine("PARAFFIN_POOL")).toBe(false);
    expect(isPackageAssignTreatmentLine("WO-TR-83", "Ozon")).toBe(true);
    expect(isPackageAssignTreatmentLine("SVC-OZONE", "Ozone")).toBe(true);
    expect(isPackageAssignTreatmentLine("NAFTALAN_BATH", "Naftalan vannası")).toBe(true);

    expect(isPackageAssignTreatmentLine("ALT", "ALAT")).toBe(false);
    expect(isPackageAssignTreatmentLine("AST", "ASAT")).toBe(false);
    expect(isPackageAssignTreatmentLine("GLU", "Şəkər qanda")).toBe(false);
    expect(isPackageAssignTreatmentLine("ECG", "EKQ ve kardiolog muayinesi")).toBe(false);
    expect(isPackageAssignTreatmentLine("GYN", "Ginekolog/urolog muayinesi")).toBe(false);
    expect(isPackageAssignTreatmentLine("NEURO", "Nevropatolog muayinesi")).toBe(false);
    expect(isPackageAssignTreatmentLine("LAB-CBC", "Qan umumi analiz")).toBe(false);
    expect(isPackageAssignTreatmentLine("LAB-URINE", "Sidik")).toBe(false);
    expect(isPackageAssignTreatmentLine("THERAPIST", "Hekim muayinesi")).toBe(false);
  });

  it("eligibleSkusForPool paraffin vs physio and excludes dedicated balances", () => {
    const types = [
      { code: "SVC-PARAFIN-ARM", name: "Parafin qol", needsSite: true, active: true },
      { code: "SVC-OZONE", name: "Ozone", needsSite: true, active: true },
      { code: "SVC-NAFTALAN", name: "Naftalan", needsSite: true, active: true },
      { code: "SVC-LAB-CBC", name: "CBC", needsSite: false, active: true },
      { code: "PHYSIO_POOL", name: "Pool", needsSite: false, active: true },
    ];
    const balances = ["PHYSIO_POOL", "PARAFFIN_POOL", "SVC-NAFTALAN"];

    const paraffin = eligibleSkusForPool("PARAFFIN_POOL", balances, types);
    expect(paraffin.map((s) => s.code)).toEqual(["SVC-PARAFIN-ARM"]);

    const physio = eligibleSkusForPool("PHYSIO_POOL", balances, types);
    const codes = physio.map((s) => s.code);
    expect(codes).toContain("SVC-OZONE");
    expect(codes).not.toContain("SVC-PARAFIN-ARM");
    expect(codes).not.toContain("SVC-NAFTALAN");
    expect(codes).not.toContain("PHYSIO_POOL");
    expect(codes).not.toContain("SVC-LAB-CBC");
  });

  it("applyQuotaRecalc never shrinks below used (stay shorten over-consume)", () => {
    const r = applyQuotaRecalc(10, 7);
    expect(r.quotaTotal).toBe(10);
    expect(r.remaining).toBe(0);
  });

  it("paramsLabelFromOrder joins sites, mode, fields, note", () => {
    const label = paramsLabelFromOrder({
      note: "soft",
      siteApplyMode: "TURN",
      physioFields: { intensity: "MEDIUM" },
      sites: [{ site: { titleEn: "Lumbar" } }],
    });
    expect(label).toContain("Lumbar");
    expect(label).toContain("TURN");
    expect(label).toContain("intensity: MEDIUM");
    expect(label).toContain("soft");
  });

  it("extraNeedsPaperTicket prefers inPackage over amountNet", () => {
    expect(extraNeedsPaperTicket({ amountNet: 0, inPackage: false })).toBe(true);
    expect(extraNeedsPaperTicket({ amountNet: 50, inPackage: true })).toBe(false);
    expect(extraNeedsPaperTicket({ amountNet: 25, packageIncluded: true })).toBe(true);
    expect(extraNeedsPaperTicket({ amountNet: 25 })).toBe(true);
    expect(extraNeedsPaperTicket({ amountNet: 0 })).toBe(false);
  });
});
