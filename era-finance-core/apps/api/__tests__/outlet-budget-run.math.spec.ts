import {
  buildOutletBudgetRows,
  scalePlanForPeriod,
} from "../src/inventory/outlet-budget-run.math";

describe("outlet non-FOOD budget (Wave 6)", () => {
  it("scales weekly plan to 14-day period", () => {
    expect(scalePlanForPeriod(70, 7, 14)).toBe(140);
  });

  it("builds plan/fact/variance per class", () => {
    const rows = buildOutletBudgetRows({
      planByClass: { CHEMICAL: 100, TABLEWARE: 50 },
      factByClass: { CHEMICAL: 120, TABLEWARE: 40, CONSUMABLE: 10 },
      warehouseCountByClass: { CHEMICAL: 1, TABLEWARE: 1, CONSUMABLE: 0, INVENTORY_GT: 0 },
      planPeriodDays: 7,
      periodDays: 7,
    });
    const chem = rows.find((r) => r.costClass === "CHEMICAL")!;
    expect(chem.planAzn).toBe(100);
    expect(chem.factAzn).toBe(120);
    expect(chem.varianceAzn).toBe(20);
    const cons = rows.find((r) => r.costClass === "CONSUMABLE")!;
    expect(cons.planAzn).toBe(0);
    expect(cons.factAzn).toBe(10);
  });
});
