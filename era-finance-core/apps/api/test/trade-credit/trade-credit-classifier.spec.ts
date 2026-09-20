import { classifyTradeCredit } from "../../src/trade-credit/trade-credit-classifier";
import {
  DEFAULT_ORG_TRADE_CREDIT_POLICY,
  type TradeCreditFeatureSnapshot,
} from "../../src/trade-credit/trade-credit-policy.types";

function features(
  partial: Partial<TradeCreditFeatureSnapshot>,
): TradeCreditFeatureSnapshot {
  return {
    maxDpd: 0,
    avgDpd: 0,
    weightedAvgDpd: 0,
    overdueShare: 0,
    partialPayRatio: 0,
    turnoverTrend: 0,
    turnoverTrendYoy: null,
    utilization: 0.5,
    paidInvoiceCount: 10,
    openAr: 100,
    creditLimit: 1000,
    maxOpenRemainder: 40,
    concentration: 0.4,
    recognizedLast90: 3000,
    recognizedSame90LastYear: 0,
    paymentTermsDays: 30,
    riskyTaxpayer: null,
    voenInactive: null,
    enrichAt: null,
    enrichStale: false,
    ...partial,
  };
}

const policy = DEFAULT_ORG_TRADE_CREDIT_POLICY;

describe("classifyTradeCredit (Appendix A + Phase 3)", () => {
  it("thin history → null group, no A/D", () => {
    const r = classifyTradeCredit(
      features({ paidInvoiceCount: 2, maxDpd: 120 }),
      policy,
    );
    expect(r.thinHistory).toBe(true);
    expect(r.group).toBeNull();
    expect(r.reasons).toContain("thin_history");
  });

  it("hard maxDpd ≥ autoDMaxDpd → D", () => {
    const r = classifyTradeCredit(
      features({ maxDpd: 90, avgDpd: 0, overdueShare: 0 }),
      policy,
    );
    expect(r.group).toBe("D");
    expect(r.reasons).toContain("hard_max_dpd");
  });

  it("HH → A", () => {
    const r = classifyTradeCredit(
      features({
        avgDpd: 3,
        weightedAvgDpd: 3,
        overdueShare: 0.05,
        turnoverTrend: 0.1,
        utilization: 0.5,
      }),
      policy,
    );
    expect(r.group).toBe("A");
    expect(r.reasons).toContain("willingness_high");
    expect(r.reasons).toContain("ability_high");
    expect(r.reasons).toContain("mapped_A");
  });

  it("HL → B", () => {
    const r = classifyTradeCredit(
      features({
        avgDpd: 2,
        weightedAvgDpd: 2,
        overdueShare: 0.1,
        turnoverTrend: -0.4,
        utilization: 0.5,
      }),
      policy,
    );
    expect(r.group).toBe("B");
    expect(r.reasons).toContain("mapped_B");
  });

  it("LH → C", () => {
    const r = classifyTradeCredit(
      features({
        maxDpd: 35,
        avgDpd: 20,
        weightedAvgDpd: 20,
        overdueShare: 0.5,
        turnoverTrend: 0.1,
        utilization: 0.4,
      }),
      policy,
    );
    expect(r.group).toBe("C");
    expect(r.reasons).toContain("mapped_C");
  });

  it("LL → D", () => {
    const r = classifyTradeCredit(
      features({
        maxDpd: 40,
        avgDpd: 25,
        weightedAvgDpd: 25,
        overdueShare: 0.5,
        turnoverTrend: -0.5,
        utilization: 0.98,
      }),
      policy,
    );
    expect(r.group).toBe("D");
    expect(r.reasons).toContain("mapped_D");
  });

  it("high util does not force ability_low (Phase 3)", () => {
    const r = classifyTradeCredit(
      features({
        avgDpd: 2,
        weightedAvgDpd: 2,
        overdueShare: 0.02,
        turnoverTrend: 0.1,
        utilization: 0.96,
      }),
      policy,
    );
    expect(r.group).toBe("A");
    expect(r.reasons).toContain("ability_high");
    expect(r.reasons).toContain("utilization_raise_alert");
    expect(r.reasons).not.toContain("ability_low");
  });

  it("weightedAvgDpd drives willingness when avgDpd is optimistic", () => {
    const r = classifyTradeCredit(
      features({
        maxDpd: 40,
        avgDpd: 5,
        weightedAvgDpd: 35,
        overdueShare: 0.1,
        turnoverTrend: 0.1,
      }),
      policy,
    );
    // weighted 35 → not high (needs ≤7); maxDpd 40 → low willingness
    expect(r.reasons).toContain("willingness_low");
    expect(r.group).toBe("C");
  });

  it("partialPayRatio ≥ 0.5 blocks willingness_high", () => {
    const r = classifyTradeCredit(
      features({
        avgDpd: 2,
        weightedAvgDpd: 2,
        overdueShare: 0.05,
        partialPayRatio: 0.6,
        turnoverTrend: 0.1,
      }),
      policy,
    );
    expect(r.reasons).toContain("partial_pay_drag");
    expect(r.reasons).not.toContain("willingness_high");
    expect(r.group).toBe("C"); // mid willingness + high ability
  });

  it("weightedAvgDpd 0 is used (does not fall back to unweighted avgDpd)", () => {
    const r = classifyTradeCredit(
      features({
        maxDpd: 40,
        avgDpd: 40,
        weightedAvgDpd: 0,
        overdueShare: 0.05,
        turnoverTrend: 0.1,
      }),
      policy,
    );
    expect(r.reasons).toContain("willingness_high");
    expect(r.group).toBe("A");
  });

  it("stale enrich ignored for force-D", () => {
    const r = classifyTradeCredit(
      features({
        avgDpd: 2,
        weightedAvgDpd: 2,
        overdueShare: 0.05,
        turnoverTrend: 0.1,
        riskyTaxpayer: true,
        enrichStale: true,
      }),
      { ...policy, enrichRiskyForcesD: true },
    );
    expect(r.group).toBe("A");
    expect(r.reasons).toContain("enrich_stale_ignored");
    expect(r.reasons).not.toContain("enrich_risky_forces_d");
  });

  it("YoY trend used for ability when present", () => {
    const r = classifyTradeCredit(
      features({
        avgDpd: 2,
        weightedAvgDpd: 2,
        overdueShare: 0.05,
        turnoverTrend: 0.5,
        turnoverTrendYoy: -0.4,
      }),
      policy,
    );
    expect(r.reasons).toContain("ability_uses_yoy");
    expect(r.reasons).toContain("ability_low");
    expect(r.group).toBe("B");
  });
});
