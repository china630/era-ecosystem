/** Scale ticket lines onto the discounted total. Quantity stays on the line. */
export function discountedLineAmounts(
  lines: Array<{ id: string; qty: number; unitPriceAzn: number }>,
  totalAzn: number,
): Map<string, number> {
  const total = Math.round(totalAzn * 100) / 100;
  if (lines.length === 0) return new Map();
  const gross = lines.reduce((sum, line) => sum + line.qty * line.unitPriceAzn, 0);
  if (!(gross > 0)) {
    return new Map(lines.map((line) => [line.id, 0]));
  }
  const scale = total / gross;
  const amounts = lines.map((line) => Math.round(line.qty * line.unitPriceAzn * scale * 100) / 100);
  const drift = Math.round((total - amounts.reduce((sum, amount) => sum + amount, 0)) * 100) / 100;
  const last = amounts.length - 1;
  amounts[last] = Math.round((amounts[last]! + drift) * 100) / 100;
  return new Map(lines.map((line, index) => [line.id, amounts[index]!]));
}
