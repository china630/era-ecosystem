export type BasketCharge = {
  id: string;
  basketRef?: string | null;
  amount: string | number;
  description: string;
  payerLabel?: string | null;
  currency: string;
  qty?: number | null;
};

export type BasketGridRow<T extends BasketCharge> = T & {
  basketCount: number;
  members: T[];
};

/** Charges that share a basketRef become one cashier row. Lone charges stay as they are. */
export function collapsePendingBaskets<T extends BasketCharge>(rows: T[]): BasketGridRow<T>[] {
  const out: BasketGridRow<T>[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const basket = row.basketRef?.trim() || "";
    if (!basket) {
      out.push({ ...row, basketCount: 1, members: [row] });
      continue;
    }
    if (seen.has(basket)) continue;
    seen.add(basket);
    const members = rows.filter((item) => item.basketRef?.trim() === basket);
    const total = members.reduce((sum, item) => sum + Number(item.amount), 0);
    const head = members[0] ?? row;
    out.push({
      ...head,
      id: `basket:${basket}`,
      description: head.payerLabel?.trim() || head.description,
      amount: total,
      basketCount: members.length,
      members,
    });
  }
  return out;
}
