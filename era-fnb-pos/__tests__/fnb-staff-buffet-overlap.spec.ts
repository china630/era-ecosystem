import {
  applyStaffBuffetOverlap,
  buildCostRunAttributionSlices,
} from "@/lib/staff-buffet-overlap";

describe("staff buffet overlap netting (Wave 3)", () => {
  it("OVERLAP_PCT: staffGross = staffNet + buffetCovered (no double-count)", () => {
    const n = applyStaffBuffetOverlap({
      staffGross: 100,
      buffetResidual: 800,
      mode: "OVERLAP_PCT",
      overlapPct: 30,
    });
    expect(n.staffNet).toBe(70);
    expect(n.buffetCoveredFromStaff).toBe(30);
    expect(n.staffNet + n.buffetCoveredFromStaff).toBe(n.staffGross);
    // OVERLAP_PCT does not consume residual pool
    expect(n.residualAfter).toBe(800);
  });

  it("SEPARATE_CENTER: full staff on staff center", () => {
    const n = applyStaffBuffetOverlap({
      staffGross: 100,
      buffetResidual: 500,
      mode: "SEPARATE_CENTER",
      overlapPct: 30,
    });
    expect(n.staffNet).toBe(100);
    expect(n.buffetCoveredFromStaff).toBe(0);
    expect(n.residualAfter).toBe(500);
  });

  it("LEFTOVER_FIRST: residual feeds staff up to pct", () => {
    const n = applyStaffBuffetOverlap({
      staffGross: 100,
      buffetResidual: 800,
      mode: "LEFTOVER_FIRST",
      overlapPct: 30,
    });
    expect(n.buffetCoveredFromStaff).toBe(30);
    expect(n.staffNet).toBe(70);
    expect(n.residualAfter).toBe(770);
    expect(n.staffNet + n.buffetCoveredFromStaff).toBe(100);
  });

  it("LEFTOVER_FIRST: zero residual → staff pays full gross", () => {
    const n = applyStaffBuffetOverlap({
      staffGross: 100,
      buffetResidual: 0,
      mode: "LEFTOVER_FIRST",
      overlapPct: 30,
    });
    expect(n.buffetCoveredFromStaff).toBe(0);
    expect(n.staffNet).toBe(100);
  });

  it("cost-run slices: attributed = pos + staffNet; residual = usage − attributed", () => {
    const s = buildCostRunAttributionSlices({
      foodUsage: 1000,
      posAttributed: 200,
      staffGross: 100,
      mode: "OVERLAP_PCT",
      overlapPct: 30,
    });
    expect(s.staffNet + s.buffetCoveredFromStaff).toBe(100);
    expect(s.attributed).toBe(270);
    expect(s.residualBuffet).toBe(730);
    expect(s.attributed + s.residualBuffet).toBe(1000);
    // buffetCoveredFromStaff is NOT also added to attributed (would double-count)
    expect(s.attributed).not.toBe(200 + 100);
  });

  it("cost-run slices LEFTOVER_FIRST keeps identity staffGross = net + covered", () => {
    const s = buildCostRunAttributionSlices({
      foodUsage: 1000,
      posAttributed: 200,
      staffGross: 100,
      mode: "LEFTOVER_FIRST",
      overlapPct: 30,
    });
    expect(s.staffNet + s.buffetCoveredFromStaff).toBe(s.staffGross);
    expect(s.attributed + s.residualBuffet).toBe(s.foodUsage);
  });
});
