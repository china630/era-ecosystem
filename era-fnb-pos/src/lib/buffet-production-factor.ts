/** plannedPortions from covers × production factor % (ADR fnb-buffet-planner). */

export function portionsFromCovers(
  coversAdult: number,
  coversChild: number,
  productionFactorPct: number,
): number {
  const covers = Math.max(0, Math.floor(coversAdult) + Math.floor(coversChild));
  const pct = Math.min(100, Math.max(0, Number(productionFactorPct) || 0));
  return Math.max(1, Math.round((covers * pct) / 100));
}

export function emptySlotWarnCount(
  slots: Array<{ lines?: unknown[] }>,
): number {
  return slots.filter((s) => !s.lines || s.lines.length === 0).length;
}
