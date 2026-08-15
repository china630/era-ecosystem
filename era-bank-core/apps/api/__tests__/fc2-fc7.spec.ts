import { BadRequestException } from "@nestjs/common";
import {
  CardDisputeStatus,
  ForbearanceStage,
  ProductKind,
} from "@era/bank-core-database";
import {
  applyCreditPolicy,
  assertDisputeTransition,
  assertForbearanceTransition,
  computeIrrbbGapMinor,
  computeMlScorePlaceholder,
  computeOpRiskCapitalAddonMinor,
  productParamHints,
  SWIFT_MT_TYPES,
  THREE_DS_THRESHOLD_MINOR,
  validateKindSpecificParams,
} from "../src/common/fc2-fc7.util";

describe("FC-2 product packs validation", () => {
  it("requires collateralFlag for mortgage products", () => {
    expect(() =>
      validateKindSpecificParams(ProductKind.LOAN_MORTGAGE, {
        termMonths: 120,
        rateAnnual: 0.12,
        glAssetCode: "141010",
        glInterestIncomeCode: "602010",
      }),
    ).toThrow(BadRequestException);
  });

  it("returns param hints for structured deposit", () => {
    const hints = productParamHints(ProductKind.STRUCTURED_DEPOSIT);
    expect(hints.some((h) => h.includes("indexLinkKey"))).toBe(true);
  });

  it("scores with policy rules and PEP review", () => {
    const result = applyCreditPolicy({
      bureauScore: 650,
      rules: { minScoreApprove: 700, minScoreReview: 600, pepAutoReview: true },
      pepFlag: true,
    });
    expect(result.decision).toBe("REVIEW");
    expect(result.reasonCodes).toContain("PEP_FLAG");
  });
});

describe("FC-2 forbearance stages", () => {
  it("allows sequential advance", () => {
    expect(() =>
      assertForbearanceTransition(ForbearanceStage.NONE, ForbearanceStage.WATCH),
    ).not.toThrow();
  });

  it("blocks skip ahead", () => {
    expect(() =>
      assertForbearanceTransition(
        ForbearanceStage.NONE,
        ForbearanceStage.PAYMENT_HOLIDAY,
      ),
    ).toThrow(BadRequestException);
  });
});

describe("FC-3 cards depth", () => {
  it("defines 3DS threshold", () => {
    expect(THREE_DS_THRESHOLD_MINOR).toBe(500_000n);
  });

  it("validates dispute workflow", () => {
    expect(() =>
      assertDisputeTransition(
        CardDisputeStatus.OPEN,
        CardDisputeStatus.UNDER_REVIEW,
      ),
    ).not.toThrow();
    expect(() =>
      assertDisputeTransition(CardDisputeStatus.OPEN, CardDisputeStatus.WON),
    ).toThrow(BadRequestException);
  });
});

describe("FC-4 treasury/trade", () => {
  it("lists SWIFT MT types for trade outbox", () => {
    expect(SWIFT_MT_TYPES).toContain("MT700");
    expect(SWIFT_MT_TYPES.length).toBeGreaterThanOrEqual(10);
  });
});

describe("FC-5 AML/risk/reg lab", () => {
  it("computes ML score from rules stub", () => {
    const score = computeMlScorePlaceholder({
      pepFlag: true,
      riskRating: "HIGH",
      alertCount30d: 2,
    });
    expect(score).toBeGreaterThanOrEqual(50);
  });

  it("computes IRRBB gap from bucket inputs", () => {
    const gap = computeIrrbbGapMinor([
      { bucketKey: "1Y", amountMinor: 1_000_000n, rateBps: 500 },
    ]);
    expect(gap.gapMinor).toBe(1_000_000n);
    expect(gap.shockedPnlMinor).toBeGreaterThan(0n);
  });

  it("computes OpRisk capital add-on stub", () => {
    const addon = computeOpRiskCapitalAddonMinor([
      { amountMinor: 100_000n, category: "FRAUD" },
    ]);
    expect(addon.addonMinor).toBe(150_000n);
  });
});

describe("FC-6 wealth/queue constants", () => {
  it("SWIFT list is readonly tuple export", () => {
    expect(Array.isArray(SWIFT_MT_TYPES)).toBe(true);
  });
});
