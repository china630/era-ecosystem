import { openDebtByArticle } from '@/lib/folio-open-debt';

describe('folio open debt by article (1005 policy)', () => {
  const companyPkg = {
    status: 'OPEN',
    charges: [{ amount: 269, qty: 1, revenueCodeId: 'pkg' }],
    payments: [] as Array<{ amount: number; revenueCodeId: string; voidedAt?: string | null }>,
  };
  const guestRoomPay = {
    status: 'OPEN',
    charges: [] as Array<{ amount: number; qty?: number; revenueCodeId: string }>,
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
