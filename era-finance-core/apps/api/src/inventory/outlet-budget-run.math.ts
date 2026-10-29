/** Non-FOOD warehouse budget plan/fact (Wave 6). */

export const NON_FOOD_COST_CLASSES = [
  "CHEMICAL",
  "CONSUMABLE",
  "TABLEWARE",
  "INVENTORY_GT",
] as const;

export type NonFoodCostClass = (typeof NON_FOOD_COST_CLASSES)[number];

export type OutletBudgetClassRow = {
  costClass: NonFoodCostClass;
  planAzn: number;
  factAzn: number;
  varianceAzn: number;
  warehouseCount: number;
};

function money(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

/** Scale a weekly (or N-day) plan to the report period length. */
export function scalePlanForPeriod(
  planAzn: number,
  planPeriodDays: number,
  periodDays: number,
): number {
  const baseDays = Math.max(1, planPeriodDays);
  const days = Math.max(1, periodDays);
  return money((planAzn * days) / baseDays);
}

export function buildOutletBudgetRows(args: {
  planByClass: Partial<Record<NonFoodCostClass, number>>;
  factByClass: Partial<Record<NonFoodCostClass, number>>;
  warehouseCountByClass: Partial<Record<NonFoodCostClass, number>>;
  planPeriodDays: number;
  periodDays: number;
}): OutletBudgetClassRow[] {
  return NON_FOOD_COST_CLASSES.map((costClass) => {
    const planRaw = money(Number(args.planByClass[costClass] ?? 0));
    const planAzn = scalePlanForPeriod(planRaw, args.planPeriodDays, args.periodDays);
    const factAzn = money(Number(args.factByClass[costClass] ?? 0));
    return {
      costClass,
      planAzn,
      factAzn,
      varianceAzn: money(factAzn - planAzn),
      warehouseCount: Math.max(0, Math.floor(args.warehouseCountByClass[costClass] ?? 0)),
    };
  });
}
