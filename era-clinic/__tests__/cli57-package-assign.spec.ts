import {
  bakuDayKey,
  PackageAssignError,
  paramsLabelFromOrder,
  paramsLinesFromOrder,
  mergeParamLines,
  assignedAggGroupKey,
  pickAdjustCancellations,
  isPackagePoolCode,
  isEntitlementBucket,
  eligibleSkusForPool,
  eligibleSkusForQuotaAlias,
  showsInProcedureMenu,
  procedurePickerBalances,
  isBathQuotaLine,
  isBathTransferQuota,
  bathTransferQuotaCode,
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

  it("showsInProcedureMenu follows the snapshot checkbox, not the code", () => {
    expect(
      showsInProcedureMenu({ isTransfer: false, inSnapshot: true, showInProcedures: true }),
    ).toBe(true);
    expect(
      showsInProcedureMenu({ isTransfer: true, inSnapshot: false, showInProcedures: false }),
    ).toBe(true);
    expect(
      showsInProcedureMenu({ isTransfer: false, inSnapshot: true, showInProcedures: false }),
    ).toBe(false);
    expect(
      showsInProcedureMenu({ isTransfer: false, inSnapshot: false, showInProcedures: true }),
    ).toBe(false);
  });

  it("a leftover pool that is off the procedure list is not a burn target", () => {
    const picker = procedurePickerBalances([
      { procedureCode: "SVC-VANNA", assignable: true },
      { procedureCode: "SVC_VANNA_POOL", assignable: false },
      { procedureCode: "SVC-FIZIO", assignable: true },
    ]);
    expect(picker.map((row) => row.procedureCode)).toEqual(["SVC-VANNA", "SVC-FIZIO"]);
  });

  it("isBathQuotaLine and XFER codes", () => {
    expect(isBathQuotaLine("NAFTALAN_BATH", "Naftalan vannası")).toBe(true);
    expect(isBathQuotaLine("SVC-OZONE", "Ozone")).toBe(false);
    expect(isBathTransferQuota("XFER-SVC-MASSAGE")).toBe(true);
    expect(bathTransferQuotaCode("SVC-MASSAGE")).toBe("XFER-SVC-MASSAGE");
    expect(isBathQuotaLine("XFER-SVC-MASSAGE", "Massage")).toBe(false);
    expect(isBathQuotaLine("SVC-APP-01", "Naftalan aplikasiyası")).toBe(true);
  });

  it("resolvePackageQuotaSku maps NAFTALAN_BATH by sex and WO-TR fallbacks", () => {
    const svc = ["SVC-NAFTALAN-VANNASI-KISI", "SVC-NAFTALAN-VANNASI-QADIN"];
    expect(resolvePackageQuotaSku("NAFTALAN_BATH", "MALE", svc)).toBe(
      "SVC-NAFTALAN-VANNASI-KISI",
    );
    expect(resolvePackageQuotaSku("NAFTALAN_BATH", "FEMALE", svc)).toBe(
      "SVC-NAFTALAN-VANNASI-QADIN",
    );
    expect(resolvePackageQuotaSku("SVC-OZONE", "MALE", svc)).toBe(null);

    const woMeta = [
      { code: "WO-TR-68", name: "Naftalan vannası (Qadın)" },
      { code: "WO-TR-72", name: "Naftalan vannası (Kişi)" },
    ];
    expect(resolvePackageQuotaSku("NAFTALAN_BATH", "FEMALE", [], woMeta)).toBe("WO-TR-68");
    expect(resolvePackageQuotaSku("NAFTALAN_BATH", "MALE", [], woMeta)).toBe("WO-TR-72");
    // UNKNOWN + both genders → picker (null)
    expect(resolvePackageQuotaSku("NAFTALAN_BATH", "UNKNOWN", [], woMeta)).toBe(null);
    expect(resolvePackageQuotaSku("NAFTALAN_BATH", null, [], woMeta)).toBe(null);
  });

  it("eligibleSkusForQuotaAlias returns both gender baths from WO-TR catalog", () => {
    const list = eligibleSkusForQuotaAlias("NAFTALAN_BATH", [
      { code: "WO-TR-68", name: "Naftalan vannası (Qadın)" },
      { code: "WO-TR-72", name: "Naftalan vannası (Kişi)" },
      { code: "SVC-OZONE", name: "Ozone" },
    ]);
    expect(list.map((x) => x.code).sort()).toEqual(["WO-TR-68", "WO-TR-72"]);
  });

  it("eligibleSkusForQuotaAlias filters by patient sex", () => {
    const types = [
      { code: "SVC-NAFTALAN-VANNASI-KISI", name: "Naftalan vannası (Kişi)" },
      { code: "SVC-NAFTALAN-VANNASI-QADIN", name: "Naftalan vannası (Qadın)" },
    ];
    expect(
      eligibleSkusForQuotaAlias("NAFTALAN_BATH", types, "FEMALE").map((x) => x.code),
    ).toEqual(["SVC-NAFTALAN-VANNASI-QADIN"]);
    expect(
      eligibleSkusForQuotaAlias("NAFTALAN_BATH", types, "MALE").map((x) => x.code),
    ).toEqual(["SVC-NAFTALAN-VANNASI-KISI"]);
    expect(
      eligibleSkusForQuotaAlias("NAFTALAN_BATH", types, "UNKNOWN")
        .map((x) => x.code)
        .sort(),
    ).toEqual(["SVC-NAFTALAN-VANNASI-KISI", "SVC-NAFTALAN-VANNASI-QADIN"]);
  });

  it("PackageAssignError PLACE_FAILED uses 409", () => {
    const err = new PackageAssignError("no slot", "PLACE_FAILED", 409);
    expect(err.code).toBe("PLACE_FAILED");
    expect(err.status).toBe(409);
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

  it("eligibleSkusForPool drops WO-TR cutover rows when SVC seed SKUs exist", () => {
    const types = [
      {
        code: "SVC-PARAFINOTERAPIYA-ASAGI-ETRAF",
        name: "Parafinoterapiya (aşağı ətraf)",
        needsSite: true,
        active: true,
      },
      {
        code: "WO-TR-10",
        name: "Парафинотерапия (нижние конечности)",
        needsSite: true,
        active: true,
      },
    ];
    const paraffin = eligibleSkusForPool("PARAFFIN_POOL", ["PARAFFIN_POOL"], types);
    expect(paraffin.map((s) => s.code)).toEqual(["SVC-PARAFINOTERAPIYA-ASAGI-ETRAF"]);
  });

  it("eligibleSkusForPool uses configured membership whitelist when present", () => {
    const types = [
      { code: "SVC-LASER", name: "Laser", needsSite: true, active: true },
      { code: "SVC-OZONE", name: "Ozone", needsSite: true, active: true },
      { code: "SVC-MAGNET", name: "Magnet", needsSite: true, active: true },
    ];
    const list = eligibleSkusForPool("PHYSIO_POOL", ["PHYSIO_POOL"], types, [
      "SVC-LASER",
      "SVC-MAGNET",
    ]);
    expect(list.map((s) => s.code).sort()).toEqual(["SVC-LASER", "SVC-MAGNET"]);
  });

  it("isEntitlementBucket is true for configured members or *_POOL", () => {
    expect(isEntitlementBucket("PHYSIO_POOL")).toBe(true);
    expect(isEntitlementBucket("CUSTOM_BLOCK", ["SVC-A"])).toBe(true);
    expect(isEntitlementBucket("SVC-OZONE", [])).toBe(false);
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
    expect(label).toContain("növbəli");
    expect(label).toContain("orta");
    expect(label).toContain("soft");
    expect(paramsLinesFromOrder({
      physioFields: { naftalanFill: "TAM", dayBlock: 2 },
    })).toEqual(["2 gün", "tam"]);
  });

  it("assignedAggGroupKey merges batches and param fingerprints for the same SKU", () => {
    const a = assignedAggGroupKey({
      procedureCode: "SVC-AMP",
      packageQuotaCode: "PHYSIO_POOL",
      locked: false,
      consumed: false,
    });
    const b = assignedAggGroupKey({
      procedureCode: "SVC-AMP",
      packageQuotaCode: "PHYSIO_POOL",
      locked: false,
      consumed: false,
    });
    expect(a).toBe(b);
    expect(mergeParamLines(["naftalanFill: TAM · dayBlock: 2", "naftalanFill: TAM · bathSequence: SITZ_THEN_FULL"])).toEqual([
      "naftalanFill: TAM",
      "dayBlock: 2",
      "bathSequence: SITZ_THEN_FULL",
    ]);
  });

  it("pickAdjustCancellations drops PROPOSED before SCHEDULED", () => {
    const proposed = {
      id: "p1",
      status: "PROPOSED",
      scheduledAt: new Date("2026-10-19T05:30:00.000Z"),
    };
    const scheduled = {
      id: "s1",
      status: "SCHEDULED",
      scheduledAt: new Date("2026-10-19T05:00:00.000Z"),
    };
    expect(
      pickAdjustCancellations([scheduled, proposed], { targetActiveQty: 1 }).map((o) => o.id),
    ).toEqual(["p1"]);
    expect(
      pickAdjustCancellations([scheduled, proposed], { targetActiveQty: 2 }),
    ).toEqual([]);
    expect(
      pickAdjustCancellations([scheduled, proposed], { cancelAllActive: true }).map((o) => o.id),
    ).toEqual(["p1", "s1"]);
  });

  it("extraNeedsPaperTicket prefers inPackage over amountNet", () => {
    expect(extraNeedsPaperTicket({ amountNet: 0, inPackage: false })).toBe(true);
    expect(extraNeedsPaperTicket({ amountNet: 50, inPackage: true })).toBe(false);
    expect(extraNeedsPaperTicket({ amountNet: 25, packageIncluded: true })).toBe(true);
    expect(extraNeedsPaperTicket({ amountNet: 25 })).toBe(true);
    expect(extraNeedsPaperTicket({ amountNet: 0 })).toBe(false);
  });
});
