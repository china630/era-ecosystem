export type SummaryCharge = {
  id: string;
  amount: number | string;
  qty?: number | null;
  businessDate?: string | Date | null;
  revenueCode?: {
    code?: string | null;
    name?: string | null;
    nameAz?: string | null;
    nameRu?: string | null;
    nameEn?: string | null;
  } | null;
};

export type SummaryPayment = {
  id?: string;
  amount: number | string;
  kind?: string | null;
  voidedAt?: string | Date | null;
  refundOfPaymentId?: string | null;
};

export type ArticleRow = {
  key: string;
  label: string;
  charged: number;
  paid: number;
  debt: number;
};

function money(n: number): number {
  return Math.round(n * 100) / 100;
}

export function revenueLabel(
  code: SummaryCharge['revenueCode'],
  locale: string,
): string {
  if (!code) return '—';
  const loc = locale.toLowerCase();
  if (loc.startsWith('az') && code.nameAz?.trim()) return code.nameAz.trim();
  if (loc.startsWith('ru') && code.nameRu?.trim()) return code.nameRu.trim();
  if (loc.startsWith('en') && code.nameEn?.trim()) return code.nameEn.trim();
  return code.name?.trim() || code.code?.trim() || '—';
}

function chargeGross(charge: SummaryCharge): number {
  const qty = charge.qty == null ? 1 : Number(charge.qty);
  return Number(charge.amount) * (Number.isFinite(qty) ? qty : 1);
}

/** Net money received: payments add, refunds subtract, voided rows are ignored. */
export function netPayments(payments: SummaryPayment[]): number {
  return payments.reduce((sum, payment) => {
    if (payment.voidedAt) return sum;
    const amount = Number(payment.amount);
    if (!Number.isFinite(amount)) return sum;
    return sum + (payment.kind === 'REFUND' ? -amount : amount);
  }, 0);
}

/**
 * Spread unallocated payments onto charges from the oldest night.
 * Payments taken against one line stay on that line when an allocation map is passed.
 */
export function folioArticleSummary(input: {
  charges: SummaryCharge[];
  payments: SummaryPayment[];
  locale: string;
  allocatedByChargeId?: Record<string, number>;
}): { rows: ArticleRow[]; charged: number; paid: number; debt: number } {
  const ordered = [...input.charges].sort((a, b) => {
    const ad = a.businessDate ? String(a.businessDate) : '';
    const bd = b.businessDate ? String(b.businessDate) : '';
    if (ad !== bd) return ad < bd ? -1 : 1;
    return a.id < b.id ? -1 : 1;
  });

  const allocated = input.allocatedByChargeId ?? {};
  let pool = Math.max(0, netPayments(input.payments));

  const grouped = new Map<string, ArticleRow>();
  for (const charge of ordered) {
    const gross = chargeGross(charge);
    const key = charge.revenueCode?.code?.trim() || charge.id;
    const label = revenueLabel(charge.revenueCode, input.locale);
    const row = grouped.get(key) ?? { key, label, charged: 0, paid: 0, debt: 0 };
    if (gross < 0) {
      row.charged += gross;
      row.debt += gross;
      grouped.set(key, row);
      continue;
    }
    const pinned = Math.min(allocated[charge.id] ?? 0, gross, pool);
    pool -= pinned;
    const fromPool = Math.min(Math.max(0, gross - pinned), pool);
    pool -= fromPool;
    const paid = pinned + fromPool;
    row.charged += gross;
    row.paid += paid;
    row.debt += gross - paid;
    grouped.set(key, row);
  }

  const rows = [...grouped.values()].map((row) => ({
    ...row,
    charged: money(row.charged),
    paid: money(row.paid),
    debt: money(row.debt),
  }));
  const charged = money(rows.reduce((s, row) => s + row.charged, 0));
  const paid = money(rows.reduce((s, row) => s + row.paid, 0));
  const debt = money(charged - paid);
  return { rows, charged, paid, debt };
}
