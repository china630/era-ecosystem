import type { DocKind } from "@era365/database";

export type SkipStep = {
  skipUnlessKind?: DocKind | null;
  minAmount?: { toString(): string } | number | string | null;
};

export type SkipDoc = {
  kind: DocKind | string;
  amount?: { toString(): string } | number | string | null;
};

function asNumber(value: SkipStep["minAmount"]): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Edges for a single chain 1→2→3. A hole or a duplicate is not a route. */
export function chainEdges(stepOrders: number[]): Array<{ fromStepOrder: number | null; toStepOrder: number }> | null {
  const sorted = [...stepOrders].sort((a, b) => a - b);
  if (sorted.length === 0 || sorted.some((order, index) => order !== index + 1)) return null;
  return sorted.map((toStepOrder, index) => ({
    fromStepOrder: index === 0 ? null : sorted[index - 1]!,
    toStepOrder,
  }));
}
export function stepSkipped(step: SkipStep, doc: SkipDoc): boolean {
  if (step.skipUnlessKind && step.skipUnlessKind !== doc.kind) return true;
  const min = asNumber(step.minAmount);
  if (min == null) return false;
  const amount = asNumber(doc.amount);
  return amount == null || amount < min;
}
