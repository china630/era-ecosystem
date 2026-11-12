import { laundryItemDisplayName, pickLaundryUnitPrices } from '@/lib/laundry-catalog-view';

export type LaundryLineView = {
  washQty: number;
  ironQty: number;
  item?: {
    name?: string | null;
    nameAz?: string | null;
    nameRu?: string | null;
    nameEn?: string | null;
    washPrice?: number | string | null;
    ironPrice?: number | string | null;
    expressWashPrice?: number | string | null;
    expressIronPrice?: number | string | null;
  } | null;
};

/** Preview / display total for a ticket from line qtys × catalog prices. */
export function laundryTicketAmount(
  lines: LaundryLineView[] | undefined,
  opts?: { express?: boolean },
): number {
  let sum = 0;
  for (const line of lines ?? []) {
    const prices = pickLaundryUnitPrices(line.item ?? {}, Boolean(opts?.express));
    if (line.washQty > 0 && prices.washPrice != null) {
      sum += line.washQty * prices.washPrice;
    }
    if (line.ironQty > 0 && prices.ironPrice != null) {
      sum += line.ironQty * prices.ironPrice;
    }
  }
  return Math.round(sum * 100) / 100;
}

/** One sentence for a ticket: washed pieces, then ironed pieces. */
export function formatLaundryPieces(
  lines: LaundryLineView[] | undefined,
  labels: { wash: string; iron: string },
  locale?: string | null,
): string {
  const nameOf = (line: LaundryLineView) =>
    laundryItemDisplayName(line.item ?? {}, locale);
  const wash = (lines ?? [])
    .filter((line) => line.washQty > 0)
    .map((line) => `${nameOf(line)} ×${line.washQty}`);
  const iron = (lines ?? [])
    .filter((line) => line.ironQty > 0)
    .map((line) => `${nameOf(line)} ×${line.ironQty}`);
  const parts: string[] = [];
  if (wash.length) parts.push(`${labels.wash}: ${wash.join(', ')}`);
  if (iron.length) parts.push(`${labels.iron}: ${iron.join(', ')}`);
  return parts.join('. ');
}
