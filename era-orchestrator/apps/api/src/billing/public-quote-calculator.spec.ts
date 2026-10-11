import { applyPreset, toggleBundle, toggleModule } from "../../../web/lib/pricing/quote-selection";
import {
  emptyCalcState,
  quoteMonthly,
  type QuoteCatalog,
} from "../../../web/lib/pricing/quote-calculator";

function catalog(): QuoteCatalog {
  const modules = [
    ["industry_hotel_pms", 29],
    ["hotel_core", 29],
    ["hotel_housekeeping", 19],
    ["hotel_migration_pro", 39],
    ["hotel_distribution", 39],
    ["hotel_guest_experience", 29],
    ["hotel_transfers", 19],
    ["hotel_banquets", 29],
    ["hotel_spa_scheduling", 29],
    ["hotel_medical_sanatorium", 39],
    ["industry_clinic", 29],
    ["clinic_registry_emr", 39],
    ["clinic_sanatorium", 99],
    ["clinic_inpatient", 39],
    ["industry_fnb_pos", 29],
    ["industry_retail", 29],
    ["cash_bank_pro", 39],
    ["inventory", 19],
    ["platform_reference_data", 29],
    ["platform_datahub_gold", 99],
    ["platform_storage", 19],
    ["platform_loyalty", 29],
    ["retail_promotions", 19],
    ["platform_workforce_pro", 0],
    ["platform_onsite_visit", 19],
    ["nas", 0],
  ].map(([key, pricePerMonth]) => ({ key: String(key), name: String(key), pricePerMonth: Number(pricePerMonth) }));

  return {
    foundationMonthlyAzn: 29,
    yearlyDiscountPercent: 20,
    modules,
    bundles: [
      {
        marketingId: "hotel_city",
        name: "Hotel City",
        discountPercent: 10,
        moduleKeys: ["hotel_core", "hotel_housekeeping", "hotel_migration_pro", "hotel_distribution"],
      },
      {
        marketingId: "cash_warehouse",
        name: "Cash & warehouse",
        discountPercent: 15,
        moduleKeys: ["cash_bank_pro", "inventory"],
      },
    ],
    capacityDrivers: [
      { satelliteKey: "industry_hotel_pms", includedInGate: 5, unitAzn: 4, unit: "room" },
      { satelliteKey: "industry_fnb_pos", includedInGate: 1, unitAzn: 19, unit: "pos" },
      { satelliteKey: "industry_retail", includedInGate: 1, unitAzn: 19, unit: "register" },
    ],
    meters: {
      pricePerUserMonthAzn: 2,
      pricePerGbMonthAzn: 0.5,
      pricePerWhatsappAlertAzn: 0.05,
      pricePerOcrPageAzn: 0.02,
      pricePerTradeCreditBuyerAzn: 1,
      pricePerTradeCreditEnrichAzn: 2,
      documentPackSize: 1000,
      pricePerDocumentPackAzn: 5,
    },
  };
}

describe("public quote calculator", () => {
  const cat = catalog();

  it("bills foundation alone at 29", () => {
    const q = quoteMonthly(cat, emptyCalcState());
    expect(q.monthlyTotalAzn).toBe(29);
    expect(q.lines.map((l) => l.kind)).toEqual(["foundation"]);
  });

  it("prices Hotel City as gate plus discounted bundle plus foundation", () => {
    const state = applyPreset("hotel_city", cat);
    const q = quoteMonthly(cat, state);
    expect(q.monthlyTotalAzn).toBe(171.4);
    expect(q.lines.find((l) => l.kind === "bundle")?.amountAzn).toBe(113.4);
    expect(q.lines.some((l) => l.key === "hotel_core")).toBe(false);
  });

  it("does not bill hotel modules twice when they are also checked", () => {
    const state = toggleModule(applyPreset("hotel_city", cat), "hotel_core", cat);
    const q = quoteMonthly(cat, state);
    expect(q.lines.filter((l) => l.key === "hotel_core")).toHaveLength(0);
    expect(q.monthlyTotalAzn).toBe(171.4);
  });

  it("bills extra hotel rooms above the gate inclusion", () => {
    const state = { ...applyPreset("hotel_city", cat), capacity: { industry_hotel_pms: 8 } };
    const q = quoteMonthly(cat, state);
    expect(q.lines.find((l) => l.kind === "capacity")?.amountAzn).toBe(12);
    expect(q.monthlyTotalAzn).toBe(183.4);
  });

  it("bills clinic rooms once, on the sanatorium chart", () => {
    const state = {
      ...emptyCalcState(),
      moduleKeys: ["industry_clinic", "clinic_registry_emr", "clinic_sanatorium"],
      clinicRooms: 10,
      clinicBeds: 9,
    };
    const q = quoteMonthly(cat, state);
    const rooms = q.lines.filter((l) => l.kind === "clinicRooms");
    expect(rooms).toHaveLength(1);
    expect(rooms[0]?.key).toBe("clinic_sanatorium");
    expect(rooms[0]?.amountAzn).toBe(95);
    expect(q.lines.some((l) => l.kind === "clinicBeds")).toBe(false);
    expect(q.warnings).toContain("clinic_beds_module");
  });

  it("bills inpatient beds only with the inpatient module", () => {
    const state = {
      ...emptyCalcState(),
      moduleKeys: ["clinic_inpatient"],
      clinicBeds: 7,
    };
    const q = quoteMonthly(cat, state);
    expect(q.lines.find((l) => l.kind === "clinicBeds")?.amountAzn).toBe(38);
    expect(q.lines.some((l) => l.key === "industry_clinic")).toBe(true);
  });

  it("waives foundation for ERA Kafe until NAS is on", () => {
    const kafe = applyPreset("kafe", cat);
    expect(quoteMonthly(cat, kafe).lines.find((l) => l.kind === "foundation")).toBeUndefined();
    expect(quoteMonthly(cat, kafe).monthlyTotalAzn).toBe(29);
    const withNas = { ...kafe, moduleKeys: [...kafe.moduleKeys, "nas"] };
    expect(quoteMonthly(cat, withNas).lines.some((l) => l.kind === "foundation")).toBe(true);
  });

  it("keeps one Data HUB tier and one loyalty side", () => {
    let state = toggleModule(emptyCalcState(), "platform_reference_data", cat);
    state = toggleModule(state, "platform_datahub_gold", cat);
    expect(state.moduleKeys.filter((k) => k.startsWith("platform_datahub") || k === "platform_reference_data")).toEqual([
      "platform_datahub_gold",
    ]);
    state = toggleModule(state, "platform_loyalty", cat);
    state = toggleModule(state, "retail_promotions", cat);
    expect(state.moduleKeys).toContain("retail_promotions");
    expect(state.moduleKeys).not.toContain("platform_loyalty");
  });

  it("bills workforce headcount and ignores a zero package price", () => {
    const state = {
      ...emptyCalcState(),
      moduleKeys: ["platform_workforce_pro", "platform_workforce"],
      workforceHeadcount: 10,
    };
    const q = quoteMonthly(cat, state);
    expect(q.lines.find((l) => l.kind === "workforce")?.amountAzn).toBe(40);
    expect(q.lines.some((l) => l.key === "platform_workforce_pro")).toBe(false);
  });

  it("estimates meters without discounting them on a yearly plan", () => {
    const state = {
      ...emptyCalcState(),
      documentsPerMonth: 2500,
      ocrPages: 60,
      storageGb: 25,
      moduleKeys: ["platform_storage"],
      yearly: true,
    };
    const q = quoteMonthly(cat, state);
    expect(q.lines.find((l) => l.kind === "documents")?.amountAzn).toBe(10);
    expect(q.lines.find((l) => l.kind === "ocr")?.amountAzn).toBe(0.2);
    expect(q.lines.find((l) => l.kind === "storage")?.amountAzn).toBe(2.5);
    expect(q.usageMonthlyAzn).toBe(12.7);
    expect(q.recurringMonthlyAzn).toBe(48);
    expect(q.yearlySubscriptionAzn).toBe(460.8);
    expect(q.monthlyTotalAzn).toBe(51.1);
  });

  it("warns instead of billing storage without the SKU", () => {
    const q = quoteMonthly(cat, { ...emptyCalcState(), storageGb: 30 });
    expect(q.warnings).toContain("storage_sku");
    expect(q.lines.some((l) => l.kind === "storage")).toBe(false);
  });

  it("keeps a one-shot visit out of the monthly total", () => {
    const state = toggleModule(emptyCalcState(), "platform_onsite_visit", cat);
    const q = quoteMonthly(cat, state);
    expect(q.oneTimeAzn).toBe(19);
    expect(q.monthlyTotalAzn).toBe(29);
  });

  it("discounts a core bundle and still adds a module outside it", () => {
    let state = toggleBundle(emptyCalcState(), "cash_warehouse", cat);
    const bundled = quoteMonthly(cat, state);
    expect(bundled.lines.find((l) => l.kind === "bundle")?.amountAzn).toBe(49.3);
    state = toggleModule(state, "platform_storage", cat);
    const q = quoteMonthly(cat, state);
    expect(q.monthlyTotalAzn).toBe(29 + 49.3 + 19);
  });

  it("clamps a negative capacity count", () => {
    const q = quoteMonthly(cat, {
      ...applyPreset("hotel_city", cat),
      capacity: { industry_hotel_pms: -4 as unknown as number },
    });
    expect(q.lines.some((l) => l.kind === "capacity")).toBe(false);
  });
});
