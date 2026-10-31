import { showsUnpaidExtraOnPlan } from "@/domain/sanatorium/extra-procedure-route";
import { printLabel } from "@/domain/print/print-labels";
import { PRINT_PROCEDURE_STATUSES } from "@/domain/print/print-procedures.service";

describe("course summary print", () => {
  it("has trilingual title and interim copy", () => {
    expect(printLabel("en", "episodeSummary")).toBe("Course summary");
    expect(printLabel("ru", "episodeSummary")).toBe("Итог курса");
    expect(printLabel("az", "episodeSummary")).toBe("Kursun yekunu");
    expect(printLabel("en", "episodeSummaryInterim")).toMatch(/interim/i);
  });

  it("reuses the seated status list; unpaid extras join the summary only on SHOW_ON_PLAN", () => {
    expect(PRINT_PROCEDURE_STATUSES).toEqual([
      "SCHEDULED",
      "CHECKED_IN",
      "COMPLETED",
      "NO_SHOW",
    ]);
    expect(showsUnpaidExtraOnPlan("PLAN_BEFORE_PAY")).toBe(true);
    expect(showsUnpaidExtraOnPlan("SHOW_ON_PLAN")).toBe(true);
    expect(showsUnpaidExtraOnPlan("HOLD_UNTIL_PAY")).toBe(false);
  });

  it("lab journal visibility matches the epicrisis pay gate shape", () => {
    const { labOrderVisibleToLabWhere } = require("@/domain/lab/lab-order-pay-gate");
    expect(labOrderVisibleToLabWhere()).toEqual({
      OR: [{ amountNet: { lte: 0 } }, { settledAt: { not: null } }],
    });
  });
});

