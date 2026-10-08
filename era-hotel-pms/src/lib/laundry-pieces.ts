export type LaundryLineView = {
  washQty: number;
  ironQty: number;
  item?: { name?: string | null } | null;
};

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
