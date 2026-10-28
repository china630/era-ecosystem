export const BUFFET_MEALS = ["BREAKFAST", "LUNCH", "DINNER"] as const;
export type BuffetMealCode = (typeof BUFFET_MEALS)[number];

export const BUFFET_STATUSES = ["DRAFT", "LOCKED", "SERVED", "CLOSED"] as const;

/** Portions after waste % (ceiling). Used by materials preview. */
export function effectiveBuffetPortions(plannedPortions: number, wastePct: number): number {
  return Math.ceil(plannedPortions * (1 + wastePct / 100));
}

/** List-table aggregates (no Prisma). */
export function planListAggregates(
  lines: Array<{
    plannedPortions: number;
    station: string;
    recipeSku?: string | null;
    financeSku?: string | null;
  }>,
) {
  const stations = [...new Set(lines.map((l) => l.station).filter(Boolean))];
  return {
    portionsSum: lines.reduce((sum, l) => sum + (l.plannedPortions || 0), 0),
    stations,
    missingBomCount: lines.filter(
      (l) => !(l.recipeSku?.trim() || l.financeSku?.trim()),
    ).length,
  };
}
