import {
  computeDaysPastDue,
  suggestIfrs9StageFromDpd,
  parseCollateralRef,
  serializeCollateral,
} from "../src/modules/loans/loan-risk.util";

describe("loan risk util", () => {
  it("suggests IFRS9 stages from DPD", () => {
    expect(suggestIfrs9StageFromDpd(0)).toBe(1);
    expect(suggestIfrs9StageFromDpd(29)).toBe(1);
    expect(suggestIfrs9StageFromDpd(30)).toBe(2);
    expect(suggestIfrs9StageFromDpd(89)).toBe(2);
    expect(suggestIfrs9StageFromDpd(90)).toBe(3);
  });

  it("computes days past due from oldest unpaid installment", () => {
    const asOf = new Date("2026-08-05T00:00:00Z");
    const dpd = computeDaysPastDue(
      [
        {
          dueDate: new Date("2026-06-01T00:00:00Z"),
          status: "SCHEDULED",
        },
        {
          dueDate: new Date("2026-07-01T00:00:00Z"),
          status: "PAID",
        },
      ],
      asOf,
    );
    expect(dpd).toBeGreaterThanOrEqual(60);
  });

  it("serializes and parses collateral JSON", () => {
    const raw = serializeCollateral({
      description: "Apartment Baku",
      amountMinor: "50000000",
      currency: "AZN",
      type: "REAL_ESTATE",
    });
    expect(parseCollateralRef(raw)?.description).toBe("Apartment Baku");
    expect(parseCollateralRef("plain-ref")?.description).toBe("plain-ref");
  });
});
