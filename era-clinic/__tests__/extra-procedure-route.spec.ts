import {
  parseExtraProcedureRoute,
  printsProcedureClock,
  showsUnpaidExtraOnPlan,
} from "@/domain/sanatorium/extra-procedure-route";

describe("extra procedure route", () => {
  it("shows an unpaid extra on the plan unless the org holds it for the cashier", () => {
    expect(parseExtraProcedureRoute(undefined)).toBe("SHOW_ON_PLAN");
    expect(parseExtraProcedureRoute(null)).toBe("SHOW_ON_PLAN");
    expect(showsUnpaidExtraOnPlan("SHOW_ON_PLAN")).toBe(true);
    expect(showsUnpaidExtraOnPlan("HOLD_UNTIL_PAY")).toBe(false);
  });

  it("does not print the placeholder clock for an unpaid extra", () => {
    expect(printsProcedureClock("PENDING_PAY")).toBe(false);
    expect(printsProcedureClock("SCHEDULED")).toBe(true);
  });
});
