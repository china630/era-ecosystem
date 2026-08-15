import { BadRequestException } from "@nestjs/common";
import { ProductKind } from "@era/bank-core-database";
import {
  moduleKeyForKind,
  parseProductParams,
  resolveCardLimits,
  resolveRateAndTerm,
  validateProductParams,
} from "../src/kernel/product-factory/product-params";

describe("product-params", () => {
  it("maps moduleKey by kind", () => {
    expect(moduleKeyForKind(ProductKind.CURRENT)).toBe("banking_core");
    expect(moduleKeyForKind(ProductKind.TERM_DEPOSIT)).toBe("banking_deposits");
    expect(moduleKeyForKind(ProductKind.LOAN_ANNUITY)).toBe("banking_loans");
    expect(moduleKeyForKind(ProductKind.CARD)).toBe("banking_cards");
  });

  it("parses CURRENT params", () => {
    expect(
      parseProductParams(ProductKind.CURRENT, {
        glLiabilityCode: "2200101",
        overdraftAllowed: false,
      }),
    ).toEqual({ glLiabilityCode: "2200101", overdraftAllowed: false });
  });

  it("parses TERM_DEPOSIT with bands", () => {
    const p = parseProductParams(ProductKind.TERM_DEPOSIT, {
      termMonths: 6,
      rateAnnual: 0.12,
      glLiabilityCode: "2200201",
      adifEligible: true,
      termMonthsMin: 3,
      termMonthsMax: 12,
    });
    expect(p.termMonths).toBe(6);
    expect(p.termMonthsMin).toBe(3);
  });

  it("rejects rateApr-style missing rateAnnual", () => {
    expect(() =>
      validateProductParams(ProductKind.LOAN_ANNUITY, {
        termMonths: 24,
        rateApr: 18,
        glAssetCode: "1300101",
        glInterestIncomeCode: "4100101",
      }),
    ).toThrow(BadRequestException);
  });

  it("rejects rateAnnual outside [0,1]", () => {
    expect(() =>
      validateProductParams(ProductKind.LOAN_ANNUITY, {
        termMonths: 24,
        rateAnnual: 18,
        glAssetCode: "1300101",
        glInterestIncomeCode: "4100101",
      }),
    ).toThrow(/rateAnnual/);
  });

  it("resolves rate/term strictly without bands", () => {
    expect(
      resolveRateAndTerm({
        templateTermMonths: 24,
        templateRateAnnual: 0.18,
        bands: {},
      }),
    ).toEqual({ termMonths: 24, rateAnnual: 0.18, pricingException: false });

    expect(() =>
      resolveRateAndTerm({
        templateTermMonths: 24,
        templateRateAnnual: 0.18,
        bands: {},
        requestedTermMonths: 36,
      }),
    ).toThrow(/fixed by the product/);
  });

  it("allows overrides inside bands", () => {
    expect(
      resolveRateAndTerm({
        templateTermMonths: 24,
        templateRateAnnual: 0.18,
        bands: { termMonthsMin: 12, termMonthsMax: 36, rateAnnualMin: 0.1, rateAnnualMax: 0.2 },
        requestedTermMonths: 30,
        requestedRateAnnual: 0.15,
      }),
    ).toEqual({ termMonths: 30, rateAnnual: 0.15, pricingException: false });
  });

  it("allows out-of-band with exception flag", () => {
    expect(
      resolveRateAndTerm({
        templateTermMonths: 24,
        templateRateAnnual: 0.18,
        bands: { rateAnnualMin: 0.1, rateAnnualMax: 0.2 },
        requestedRateAnnual: 0.25,
        allowException: true,
        exceptionReason: "VIP exception",
      }),
    ).toEqual({ termMonths: 24, rateAnnual: 0.25, pricingException: true });
  });

  it("tightens card limits only", () => {
    const product = {
      scheme: "VISA",
      cardType: "DEBIT",
      dailySpendLimitMinor: 500_000,
      atmDailyLimitMinor: 100_000,
      perTxnMaxMinor: 50_000,
    };
    expect(
      resolveCardLimits({
        product,
        requested: { dailySpendLimitMinor: 200_000 },
      }).dailySpendLimitMinor,
    ).toBe(200_000);

    expect(() =>
      resolveCardLimits({
        product,
        requested: { dailySpendLimitMinor: 900_000 },
      }),
    ).toThrow(/cannot exceed/);
  });
});
