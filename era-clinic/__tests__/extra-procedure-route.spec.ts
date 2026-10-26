import {
  parseExtraProcedureRoute,
  plansExtraBeforePay,
  printsProcedureClock,
  showsUnpaidExtraOnPlan,
} from "@/domain/sanatorium/extra-procedure-route";

describe("extra procedure route", () => {
  it("plans an unpaid extra before payment unless the org waits for the cashier", () => {
    expect(parseExtraProcedureRoute(undefined)).toBe("PLAN_BEFORE_PAY");
    expect(parseExtraProcedureRoute(null)).toBe("PLAN_BEFORE_PAY");
    expect(parseExtraProcedureRoute("SHOW_ON_PLAN")).toBe("PLAN_BEFORE_PAY");
    expect(parseExtraProcedureRoute("PLAN_BEFORE_PAY")).toBe("PLAN_BEFORE_PAY");
    expect(plansExtraBeforePay("PLAN_BEFORE_PAY")).toBe(true);
    expect(plansExtraBeforePay("SHOW_ON_PLAN")).toBe(true);
    expect(showsUnpaidExtraOnPlan("HOLD_UNTIL_PAY")).toBe(false);
    expect(plansExtraBeforePay("HOLD_UNTIL_PAY")).toBe(false);
  });

  it("prints the real clock only when the unpaid extra already holds a cabin", () => {
    expect(printsProcedureClock("PENDING_PAY")).toBe(false);
    expect(printsProcedureClock("PENDING_PAY", null)).toBe(false);
    expect(printsProcedureClock("PENDING_PAY", "cabin-1")).toBe(true);
    expect(printsProcedureClock("SCHEDULED")).toBe(true);
  });
});
