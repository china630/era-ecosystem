import { stayMoneyPair, type MoneyLine } from '@/lib/folio-money-pair';

export type FolioDebtSlice = {
  status: string;
  charges: MoneyLine[];
  payments?: MoneyLine[] | null;
};

export type ArticleDebtRow = {
  revenueCodeId: string;
  debt: number;
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
