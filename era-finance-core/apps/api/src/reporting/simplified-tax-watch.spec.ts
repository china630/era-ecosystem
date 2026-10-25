import {
  computeSimplifiedWatch,
  rollingTwelveMonthStart,
  type SchemeParams,
} from "./simplified-tax-watch.calc";

const scheme: SchemeParams = {
  vatThresholdAzn: "200000",
  posCoefficient: "0.5",
  eqaimeShareLimit: "0.30",
  defaultSimplifiedPercent: "2",
  posSimplifiedPercent: "6",
  posRateEffectiveFrom: "2026-01-01",
  posRateEffectiveTo: "2028-12-31",
  vatPercent: "18",
};

function watch(
  partial: Partial<Parameters<typeof computeSimplifiedWatch>[0]> &
    Pick<Parameters<typeof computeSimplifiedWatch>[0], "period" | "lines">,
) {
  return computeSimplifiedWatch({
    schemeCode: "AZ_STATUTORY",
    scheme,
    regime: "SIMPLIFIED",
    pricesIncludeTax: false,
    registeredInvoiceTotal: "0",
    registeredInvoiceCovered: "0",
    ...partial,
  });
}

describe("simplified tax watch", () => {
  it("does not apply the 6% POS rate before 2026", () => {
    const result = watch({
      period: "2025-12",
      lines: [{ date: "2025-12-15", bucket: "card", population: true, amount: "1000" }],
    });
    expect(result.simplifiedTaxAmountAzn).toBe("20.00");
    expect(result.adjustedTurnoverAzn).toBe("1000.00");
    expect(result.regime).toBe("SIMPLIFIED");
  });

  it("counts cash and bank in full for the threshold and at the default rate", () => {
    const result = watch({
      period: "2026-02",
      lines: [
        { date: "2026-02-01", bucket: "bank", population: false, amount: "1000" },
        { date: "2026-02-02", bucket: "cash", population: false, amount: "1000" },
      ],
    });
    expect(result.simplifiedTaxAmountAzn).toBe("40.00");
    expect(result.adjustedTurnoverAzn).toBe("2000.00");
  });

  it("does not give unmarked card the POS coefficient or the 6% rate", () => {
    const result = watch({
      period: "2026-06",
      lines: [{ date: "2026-06-01", bucket: "card", population: false, amount: "1000" }],
    });
    expect(result.simplifiedTaxAmountAzn).toBe("20.00");
    expect(result.cardUnmarkedAzn).toBe("1000.00");
    expect(result.adjustedTurnoverAzn).toBe("1000.00");
  });

  it("applies 6% and the 0.5 coefficient only to population card inside the POS window", () => {
    const result = watch({
      period: "2026-06",
      lines: [{ date: "2026-06-01", bucket: "card", population: true, amount: "1000" }],
    });
    expect(result.simplifiedTaxAmountAzn).toBe("60.00");
    expect(result.adjustedTurnoverAzn).toBe("500.00");
  });

  it("raises a price-review marker when the e-qaimə share is over 30% and posts nothing", () => {
    const result = watch({
      period: "2026-03",
      lines: [],
      registeredInvoiceTotal: "1000",
      registeredInvoiceCovered: "400",
      pricesIncludeTax: true,
    });
    expect(result.priceReview).toBe(true);
    expect(result.priceReviewReasons).toContain("EQAIME_SHARE");
    expect(result.simplifiedTaxAmountAzn).toBe("0.00");
    expect(result.regime).toBe("SIMPLIFIED");
    expect(result.priceExample).toEqual({
      grossAzn: "100.00",
      netAzn: "84.75",
      marginDropAzn: "15.25",
      vatPercent: "18",
    });
    expect(result).not.toHaveProperty("journalLines");
  });

  it("opens the rolling 12 months on the first day, including a leap February", () => {
    expect(rollingTwelveMonthStart("2026-02-28")).toBe("2025-03-01");
    expect(rollingTwelveMonthStart("2024-02-29")).toBe("2023-03-01");
  });
});
