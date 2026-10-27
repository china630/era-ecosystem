export type LaundryLineView = {
  washQty: number;
  ironQty: number;
  item?: {
    name?: string | null;
    washPrice?: number | string | null;
    ironPrice?: number | string | null;
  } | null;
};

/** Preview / display total for a ticket from line qtys × catalog prices (+ optional express %). */
export function laundryTicketAmount(
  lines: LaundryLineView[] | undefined,
  opts?: { express?: boolean; expressPercent?: number | null },
): number {
  let sum = 0;
  for (const line of lines ?? []) {
    const wash = Number(line.item?.washPrice ?? 0);
    const iron = Number(line.item?.ironPrice ?? 0);
    sum += line.washQty * (Number.isFinite(wash) ? wash : 0);
    sum += line.ironQty * (Number.isFinite(iron) ? iron : 0);
  }
  const pct = opts?.expressPercent;
  if (opts?.express && pct != null && pct > 0) {
    sum = sum * (1 + pct / 100);
  }
  return Math.round(sum * 100) / 100;
}

/** One sentence for a ticket: washed pieces, then ironed pieces. */
export function formatLaundryPieces(
  lines: LaundryLineView[] | undefined,
  labels: { wash: string; iron: string },
): string {
  const nameOf = (line: LaundryLineView) => line.item?.name?.trim() || "—";
  const wash = (lines ?? [])
    .filter((line) => line.washQty > 0)
    .map((line) => `${nameOf(line)} ×${line.washQty}`);
  const iron = (lines ?? [])
    .filter((line) => line.ironQty > 0)
    .map((line) => `${nameOf(line)} ×${line.ironQty}`);
  const parts: string[] = [];
  if (wash.length) parts.push(`${labels.wash}: ${wash.join(", ")}`);
  if (iron.length) parts.push(`${labels.iron}: ${iron.join(", ")}`);
  return parts.join(". ");
}
