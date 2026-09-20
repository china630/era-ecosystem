import {
  DEFAULT_ORG_TRADE_CREDIT_POLICY,
  type TradeCreditFeatureSnapshot,
} from "../../src/trade-credit/trade-credit-policy.types";
import { suggestTradeCreditLimit } from "../../src/trade-credit/trade-credit-limit";

function features(
  partial: Partial<TradeCreditFeatureSnapshot>,
): TradeCreditFeatureSnapshot {
  return {
    maxDpd: 0,
    avgDpd: 0,
    weightedAvgDpd: 0,
    overdueShare: 0,
    partialPayRatio: 0,
    turnoverTrend: 0.1,
    turnoverTrendYoy: null,
    utilization: 0.5,
    paidInvoiceCount: 10,
    openAr: 100,
    creditLimit: 1000,
    maxOpenRemainder: 50,
    concentration: 0.5,
    recognizedLast90: 9000,
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

describe("suggestTradeCreditLimit (Appendix B)", () => {
  it("D → suggested 0", () => {
    const r = suggestTradeCreditLimit({
      features: features({}),
      policy,
      group: "D",
      thinHistory: false,
    });
    expect(r.suggested).toBe(0);
    expect(r.kind).toBeNull();
  });

  it("thin history → TRIAL capped", () => {
    const r = suggestTradeCreditLimit({
      features: features({ creditLimit: 0, paidInvoiceCount: 1 }),
      policy,
      group: null,
      thinHistory: true,
      lastRecognizedInvoiceAmount: 200,
    });
    expect(r.suggested).toBe(200);
    expect(r.kind).toBe("TRIAL");
  });

  it("thin history trial is min(cap, last); missing last → 0", () => {
    const capped = suggestTradeCreditLimit({
      features: features({ creditLimit: 0 }),
      policy,
      group: null,
      thinHistory: true,
      lastRecognizedInvoiceAmount: 800,
    });
    expect(capped.suggested).toBe(500);
    const empty = suggestTradeCreditLimit({
      features: features({ creditLimit: 0 }),
      policy,
      group: null,
      thinHistory: true,
      lastRecognizedInvoiceAmount: null,
    });
    expect(empty.suggested).toBe(0);
    expect(empty.kind).toBeNull();
  });

  it("missing paymentTermsDays defaults to 30", () => {
    const r = suggestTradeCreditLimit({
      features: features({ creditLimit: 100, paymentTermsDays: 0 }),
      policy,
      group: "A",
      thinHistory: false,
    });
    expect(r.suggested).toBe(3000);
  });

  it("A working capital ≈ monthly × terms", () => {
    // recognizedLast90=9000 → monthly 3000; terms 30 → 3000; overdue 0; mult A 1
    const r = suggestTradeCreditLimit({
      features: features({ creditLimit: 1000 }),
      policy,
      group: "A",
      thinHistory: false,
    });
    expect(r.suggested).toBe(3000);
    expect(r.kind).toBe("WORKING_CAPITAL");
    expect(r.withinDeadband).toBe(false);
  });

  it("5% deadband suppresses proposal", () => {
    const r = suggestTradeCreditLimit({
      features: features({
        creditLimit: 3000,
        recognizedLast90: 9000,
      }),
      policy,
      group: "A",
      thinHistory: false,
    });
    expect(r.withinDeadband).toBe(true);
    expect(r.kind).toBeNull();
  });

  it("B applies groupMultB", () => {
    const r = suggestTradeCreditLimit({
      features: features({ creditLimit: 100 }),
      policy,
      group: "B",
      thinHistory: false,
    });
    expect(r.suggested).toBe(1500); // 3000 * 0.5
  });

  it("partial + concentration haircuts stack", () => {
    const r = suggestTradeCreditLimit({
      features: features({
        creditLimit: 100,
        partialPayRatio: 0.4,
        concentration: 0.9,
      }),
      policy,
      group: "A",
      thinHistory: false,
    });
    // 3000 * 0.8 * 0.7 = 1680
    expect(r.suggested).toBe(1680);
    expect(r.reasons).toEqual(
      expect.arrayContaining(["partial_pay_haircut", "concentration_haircut"]),
    );
  });

  it("fresh enrich → ENRICH_HAIRCUT when below current", () => {
    const r = suggestTradeCreditLimit({
      features: features({
        creditLimit: 5000,
        riskyTaxpayer: true,
        enrichStale: false,
      }),
      policy,
      group: "A",
      thinHistory: false,
    });
    expect(r.suggested).toBe(1500); // 3000 * 0.5
    expect(r.kind).toBe("ENRICH_HAIRCUT");
  });

  it("stale enrich does not haircut", () => {
    const r = suggestTradeCreditLimit({
      features: features({
        creditLimit: 100,
        riskyTaxpayer: true,
        enrichStale: true,
      }),
      policy,
      group: "A",
      thinHistory: false,
    });
    expect(r.suggested).toBe(3000);
    expect(r.kind).toBe("WORKING_CAPITAL");
  });
});
