import {
  bakuDayKey,
  PackageAssignError,
  paramsLabelFromOrder,
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
