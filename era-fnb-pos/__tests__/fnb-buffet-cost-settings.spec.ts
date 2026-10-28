import {
  defaultBuffetCostOrgDefaults,
  parseBuffetCostSettings,
  resolveBuffetCostForOutlet,
} from "@/lib/buffet-cost-settings";

describe("buffet cost settings (Wave 1)", () => {
  it("defaults hotelMode to DAY_DOCUMENT and HYBRID + 30% overlap", () => {
    const d = defaultBuffetCostOrgDefaults(true);
    expect(d.buffetCostModel).toBe("HYBRID");
    expect(d.staffBuffetOverlap).toBe("OVERLAP_PCT");
    expect(d.overlapPct).toBe(30);
    expect(d.cogsPostingMode).toBe("DAY_DOCUMENT");
    expect(d.inventoryGtThresholdAzn).toBe(500);
    expect(d.stocktakePolicy.FOOD).toBe("WEEKLY");
    expect(d.stocktakePolicy.TABLEWARE).toBe("EVERY_15_DAYS");
    expect(d.stocktakePolicy.INVENTORY_GT).toBe("QUARTERLY");
  });

  it("defaults standalone (hotelMode=false) to SALE_POST", () => {
    expect(defaultBuffetCostOrgDefaults(false).cogsPostingMode).toBe("SALE_POST");
  });

  it("parses null as org defaults", () => {
    const s = parseBuffetCostSettings(null, true);
    expect(s.orgDefaults.cogsPostingMode).toBe("DAY_DOCUMENT");
    expect(s.outletOverrides).toEqual({});
    expect(s.forecastPack.keySkuNorms.map((r) => r.sku)).toContain("MEAT");
    expect(s.forecastPack.bands.map((b) => b.code)).toContain("MID");
  });

  it("clamps overlap and rejects inverted warning band", () => {
    const s = parseBuffetCostSettings(
      {
        orgDefaults: {
          overlapPct: 150,
          warningVarianceLowPct: 120,
          warningVarianceHighPct: 80,
        },
      },
      true,
    );
    expect(s.orgDefaults.overlapPct).toBe(100);
    expect(s.orgDefaults.warningVarianceLowPct).toBe(70);
    expect(s.orgDefaults.warningVarianceHighPct).toBe(110);
  });

  it("merges outlet override over org defaults", () => {
    const s = parseBuffetCostSettings(
      {
        orgDefaults: {
          buffetCostModel: "HYBRID",
          cogsPostingMode: "DAY_DOCUMENT",
          overlapPct: 30,
        },
        outletOverrides: {
          out_cafe: { buffetCostModel: "OFF", overlapPct: 0 },
        },
      },
      true,
    );
    const cafe = resolveBuffetCostForOutlet(s, "out_cafe");
    expect(cafe.buffetCostModel).toBe("OFF");
    expect(cafe.overlapPct).toBe(0);
    expect(cafe.cogsPostingMode).toBe("DAY_DOCUMENT");
    expect(resolveBuffetCostForOutlet(s, "other").buffetCostModel).toBe("HYBRID");
  });

  it("ignores unknown enum values", () => {
    const s = parseBuffetCostSettings(
      { orgDefaults: { buffetCostModel: "WEIRD", cogsPostingMode: "NOPE" } },
      false,
    );
    expect(s.orgDefaults.buffetCostModel).toBe("HYBRID");
    expect(s.orgDefaults.cogsPostingMode).toBe("SALE_POST");
  });

  it("drops empty outlet override objects (UI must materialize fields)", () => {
    const s = parseBuffetCostSettings(
      { orgDefaults: {}, outletOverrides: { ghost: {} } },
      true,
    );
    expect(s.outletOverrides).toEqual({});
  });
});
