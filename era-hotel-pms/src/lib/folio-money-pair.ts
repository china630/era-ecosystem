/**
 * Two sums on a stay, not one net.
 * Debt is charges an article payment has not covered.
 * Unused is what is left on the blue payment lines.
 * A room payment does not cover a medical charge.
 */

export type MoneyLine = {
  id?: string;
  amount: unknown;
  qty?: number | null;
  kind?: string | null;
  voidedAt?: string | Date | null;
  revenueCodeId?: string | null;
  refundOfPaymentId?: string | null;
  revenueCode?: { code?: string | null } | null;
};

function num(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof value === 'object' && value && 'toNumber' in value) {
    const n = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function articleKeyOf(row: {
  revenueCodeId?: string | null;
  revenueCode?: { code?: string | null } | null;
}): string {
  return row.revenueCodeId || row.revenueCode?.code?.trim() || '';
}

export function stayMoneyPair(
  charges: MoneyLine[],
  payments: MoneyLine[],
  articleKey?: string | null,
): { debt: number; unused: number } {
  const filter = articleKey?.trim() || '';
  const refundByOriginal = new Map<string, number>();
  let orphanRefund = 0;
  for (const payment of payments) {
    if (payment.voidedAt) continue;
    if (payment.kind !== 'REFUND') continue;
    const amount = num(payment.amount);
    if (payment.refundOfPaymentId && payment.id == null) {
      orphanRefund += amount;
      continue;
    }
    if (payment.refundOfPaymentId) {
      refundByOriginal.set(
        payment.refundOfPaymentId,
        (refundByOriginal.get(payment.refundOfPaymentId) ?? 0) + amount,
      );
    } else {
      orphanRefund += amount;
    }
  }

  const buckets = new Map<string, { charges: number; payments: number }>();
  const bucket = (key: string) => {
    const found = buckets.get(key);
    if (found) return found;
    const created = { charges: 0, payments: 0 };
    buckets.set(key, created);
    return created;
  };

  for (const charge of charges) {
    const qty = charge.qty == null ? 1 : Number(charge.qty);
    bucket(articleKeyOf(charge)).charges += num(charge.amount) * (Number.isFinite(qty) ? qty : 1);
  }
  for (const payment of payments) {
    if (payment.voidedAt || payment.kind === 'REFUND') continue;
    const refunded = payment.id ? refundByOriginal.get(payment.id) ?? 0 : 0;
    bucket(articleKeyOf(payment)).payments += num(payment.amount) - refunded;
  }

  let debt = 0;
  let unused = 0;
  let loosePay = 0;
  for (const [key, row] of buckets) {
    if (filter && key !== filter) continue;
    if (!key) {
      if (row.charges > 0) debt += row.charges;
      if (row.payments > 0) loosePay += row.payments;
      if (row.charges < 0) loosePay += -row.charges;
      continue;
    }
    const net = row.charges - row.payments;
    if (net > 0.009) debt += net;
    else if (net < -0.009) unused += -net;
  }
  if (!filter) {
    const take = Math.min(debt, Math.max(0, loosePay));
    debt -= take;
    loosePay -= take;
    unused += Math.max(0, loosePay);
    debt += orphanRefund;
  }
  return { debt: round2(Math.max(0, debt)), unused: round2(Math.max(0, unused)) };
}
