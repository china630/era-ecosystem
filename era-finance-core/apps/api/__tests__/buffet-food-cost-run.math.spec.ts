import { buildHybridFoodCostRun } from "../src/inventory/buffet-food-cost-run.math";

describe("HYBRID buffet FOOD cost run (Wave 5)", () => {
  it("residual = usage − attributed; variance = residual − theoretical", () => {
    const r = buildHybridFoodCostRun({
      foodUsageAzn: 1000,
      posSaleAzn: 200,
      posCompAzn: 50,
      staffNetAzn: 70,
      theoreticalAzn: 600,
      warningVarianceLowPct: 70,
      warningVarianceHighPct: 110,
      reliability: "COMPLETE",
    });
    expect(r.posAttributedAzn).toBe(250);
    expect(r.attributedAzn).toBe(320);
    expect(r.residualBuffetAzn).toBe(680);
    expect(r.varianceAzn).toBe(80);
    expect(r.reliability).toBe("COMPLETE");
  });

  it("ISSUES_ONLY when stocktake missing", () => {
    const r = buildHybridFoodCostRun({
      foodUsageAzn: 100,
      posSaleAzn: 0,
      posCompAzn: 0,
      staffNetAzn: 0,
      theoreticalAzn: 100,
      warningVarianceLowPct: 70,
      warningVarianceHighPct: 110,
      reliability: "ISSUES_ONLY",
    });
    expect(r.warnings.some((w) => w.includes("ISSUES_ONLY"))).toBe(true);
  });

  it("SKU meat 750 vs TTK 1000 → soft high-band warning", () => {
    const r = buildHybridFoodCostRun({
      foodUsageAzn: 750,
      posSaleAzn: 0,
      posCompAzn: 0,
      staffNetAzn: 0,
      theoreticalAzn: 1000,
      warningVarianceLowPct: 70,
      warningVarianceHighPct: 110,
      reliability: "COMPLETE",
      skuRows: [
        { sku: "MEAT", name: "Beef", usageAzn: 750, theoreticalAzn: 1000 },
      ],
    });
    // residual 750 vs theo 1000 → 75% — within 70–110, no total warning
    expect(r.residualBuffetAzn).toBe(750);
    expect(r.varianceAzn).toBe(-250);
    // SKU actual/theo = 75% — also within band
    expect(r.skuRows[0]?.actualVsTheoreticalPct).toBe(75);
    expect(r.skuRows[0]?.warning).toBeNull();

    const high = buildHybridFoodCostRun({
      foodUsageAzn: 1200,
      posSaleAzn: 0,
      posCompAzn: 0,
      staffNetAzn: 0,
      theoreticalAzn: 1000,
      warningVarianceLowPct: 70,
      warningVarianceHighPct: 110,
      reliability: "COMPLETE",
      skuRows: [
        { sku: "MEAT", name: "Beef", usageAzn: 1200, theoreticalAzn: 1000 },
      ],
    });
    expect(high.skuRows[0]?.warning).toMatch(/MEAT/);
    expect(high.warnings.some((w) => w.includes("MEAT"))).toBe(true);
  });

  it("COMP stays inside attributed (not silent residual-only)", () => {
    const withComp = buildHybridFoodCostRun({
      foodUsageAzn: 500,
      posSaleAzn: 100,
      posCompAzn: 40,
      staffNetAzn: 0,
      theoreticalAzn: 0,
      warningVarianceLowPct: 70,
      warningVarianceHighPct: 110,
      reliability: "COMPLETE",
    });
    expect(withComp.posCompAzn).toBe(40);
    expect(withComp.residualBuffetAzn).toBe(360);
  });
});
