import {
  stayCategoryMoneyPair,
  stayMoneyPair,
  type MoneyLine,
} from '@/lib/folio-money-pair';
import {
  PAYMENT_CATEGORIES,
  resolvePaymentCategory,
  type PaymentCategory,
} from '@/lib/payment-category';

export type FolioDebtSlice = {
  status: string;
  charges: MoneyLine[];
  payments?: MoneyLine[] | null;
};

export type ArticleDebtRow = {
  revenueCodeId: string;
  debt: number;
};

export type CategoryDebtRow = {
  category: PaymentCategory;
  debt: number;
  unused: number;
};

/** Open debt per revenue article across open folios (stay-wide). */
export function openDebtByArticle(folios: FolioDebtSlice[]): ArticleDebtRow[] {
  const open = folios.filter((folio) => folio.status === 'OPEN');
  const ids = new Set<string>();
  for (const folio of open) {
    for (const charge of folio.charges) {
      const id = charge.revenueCodeId?.trim();
      if (id) ids.add(id);
    }
    for (const payment of folio.payments ?? []) {
      if (payment.voidedAt) continue;
      const id = payment.revenueCodeId?.trim();
      if (id) ids.add(id);
    }
  }
  const rows: ArticleDebtRow[] = [];
  for (const revenueCodeId of ids) {
    const pair = stayMoneyPair(
      open.flatMap((folio) =>
        folio.charges.filter((row) => row.revenueCodeId === revenueCodeId),
      ),
      open.flatMap((folio) =>
        (folio.payments ?? []).filter((row) => row.revenueCodeId === revenueCodeId),
      ),
    );
    if (pair.debt > 0.01) rows.push({ revenueCodeId, debt: pair.debt });
  }
  rows.sort((a, b) => b.debt - a.debt);
  return rows;
}

export function stayHasOpenDebt(folios: FolioDebtSlice[]): boolean {
  return openDebtByArticle(folios).length > 0;
}

export function articleHasOpenDebt(folios: FolioDebtSlice[], revenueCodeId: string): boolean {
  return openDebtByArticle(folios).some((row) => row.revenueCodeId === revenueCodeId);
}

/** Open debt / unused per cashier category on one pocket (or stay-wide open folios). */
export function openDebtByCategory(folios: FolioDebtSlice[]): CategoryDebtRow[] {
  const open = folios.filter((folio) => folio.status === 'OPEN');
  const charges = open.flatMap((folio) => folio.charges);
  const payments = open.flatMap((folio) => folio.payments ?? []);
  const rows: CategoryDebtRow[] = [];
  for (const category of PAYMENT_CATEGORIES) {
    const pair = stayCategoryMoneyPair(charges, payments, category);
    if (pair.debt > 0.01 || pair.unused > 0.01) {
      rows.push({ category, debt: pair.debt, unused: pair.unused });
    }
  }
  return rows;
}

export function categorySpend(folios: FolioDebtSlice[]): Record<PaymentCategory, number> {
  const open = folios.filter((folio) => folio.status === 'OPEN');
  const out: Record<PaymentCategory, number> = {
    LODGING: 0,
    CLINIC: 0,
    FB: 0,
    OTHER: 0,
  };
  for (const folio of open) {
    for (const charge of folio.charges) {
      const cat = resolvePaymentCategory(charge);
      if (!cat) continue;
      const qty = charge.qty == null ? 1 : Number(charge.qty);
      const amount = Number(charge.amount);
      if (!Number.isFinite(amount)) continue;
      out[cat] += amount * (Number.isFinite(qty) ? qty : 1);
    }
  }
  for (const key of PAYMENT_CATEGORIES) {
    out[key] = Math.round(out[key] * 100) / 100;
  }
  return out;
}
