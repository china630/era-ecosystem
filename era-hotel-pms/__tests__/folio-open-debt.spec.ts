/**
 * Pure policy for Accept payment: open debt by article across pockets
 * (mirrors src/lib/folio-open-debt + stayMoneyPair article buckets).
 */
import { describe, expect, it } from 'vitest';

type Line = { amount: number; qty?: number | null; revenueCodeId?: string | null; voidedAt?: string | null };

function articleDebt(
  charges: Line[],
  payments: Line[],
  revenueCodeId: string,
): number {
  const c = charges
    .filter((row) => row.revenueCodeId === revenueCodeId)
    .reduce((s, row) => s + Number(row.amount) * (row.qty == null ? 1 : Number(row.qty)), 0);
  const p = payments
    .filter((row) => !row.voidedAt && row.revenueCodeId === revenueCodeId)
    .reduce((s, row) => s + Number(row.amount), 0);
  return Math.max(0, Math.round((c - p) * 100) / 100);
}

function openDebtByArticle(
  folios: Array<{ status: string; charges: Line[]; payments?: Line[] }>,
): Array<{ revenueCodeId: string; debt: number }> {
  const open = folios.filter((folio) => folio.status === 'OPEN');
  const ids = new Set<string>();
  for (const folio of open) {
    for (const charge of folio.charges) {
      if (charge.revenueCodeId) ids.add(charge.revenueCodeId);
    }
    for (const payment of folio.payments ?? []) {
      if (!payment.voidedAt && payment.revenueCodeId) ids.add(payment.revenueCodeId);
    }
  }
  const rows: Array<{ revenueCodeId: string; debt: number }> = [];
  for (const revenueCodeId of ids) {
    const debt = articleDebt(
      open.flatMap((folio) => folio.charges),
      open.flatMap((folio) => folio.payments ?? []),
      revenueCodeId,
    );
    if (debt > 0.01) rows.push({ revenueCodeId, debt });
  }
  return rows.sort((a, b) => b.debt - a.debt);
}

describe('folio open debt by article (1005 policy)', () => {
  const companyPkg = {
    status: 'OPEN',
    charges: [{ amount: 269, qty: 1, revenueCodeId: 'pkg' }],
    payments: [] as Line[],
  };
  const guestRoomPay = {
    status: 'OPEN',
    charges: [] as Line[],
    payments: [{ amount: 269, revenueCodeId: 'room', voidedAt: null }],
  };

  it('lists medical debt while room credit sits on another pocket', () => {
    expect(openDebtByArticle([companyPkg, guestRoomPay])).toEqual([
      { revenueCodeId: 'pkg', debt: 269 },
    ]);
  });

  it('ROOM article has no open debt when only PKG owes', () => {
    const rows = openDebtByArticle([companyPkg, guestRoomPay]);
    expect(rows.some((row) => row.revenueCodeId === 'room')).toBe(false);
  });

  it('ignores closed folios', () => {
    expect(openDebtByArticle([{ ...companyPkg, status: 'CLOSED' }, guestRoomPay])).toEqual([]);
  });
});
