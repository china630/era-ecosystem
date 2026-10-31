/**
 * Paid-fact revenue statement. Article codes come from revenueCodeForServiceLine
 * (department, modality, or the clinic default). Nothing is hardcoded: a new
 * article shows up as its own row when a paid line resolves to it.
 */

export type RevenueRow = {
  revenueCode: string;
  quantity: number;
  amount: number;
};

export function accumulateRevenue(
  lines: Array<{ revenueCode: string; quantity: number; amount: number }>,
): RevenueRow[] {
  const byCode = new Map<string, RevenueRow>();
  for (const line of lines) {
    const revenueCode = line.revenueCode.trim() || "—";
    const amount = Number(line.amount);
    const quantity = Number(line.quantity);
    if (!(amount > 0)) continue;
    const prev = byCode.get(revenueCode);
    if (!prev) {
      byCode.set(revenueCode, { revenueCode, quantity, amount });
      continue;
    }
    prev.quantity += quantity;
    prev.amount = Math.round((prev.amount + amount) * 100) / 100;
  }
  return [...byCode.values()].sort((a, b) => a.revenueCode.localeCompare(b.revenueCode));
}
