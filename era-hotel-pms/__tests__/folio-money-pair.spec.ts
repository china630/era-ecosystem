import { stayMoneyPair } from '../src/lib/folio-money-pair';

describe('stay money pair', () => {
  it('keeps a room payment off the medical debt', () => {
    const pair = stayMoneyPair(
      [
        { amount: 230, qty: 1, revenueCodeId: 'room' },
        { amount: 100, qty: 1, revenueCodeId: 'med' },
      ],
      [{ id: 'p1', amount: 3000, kind: 'PAYMENT', revenueCodeId: 'room' }],
    );
    expect(pair).toEqual({ debt: 100, unused: 2770 });
  });

  it('lets a night consume the room payment and leaves the rest', () => {
    const pair = stayMoneyPair(
      [{ amount: 279, qty: 1, revenueCodeId: 'room' }],
      [{ id: 'p1', amount: 3000, kind: 'PAYMENT', revenueCodeId: 'room' }],
    );
    expect(pair).toEqual({ debt: 0, unused: 2721 });
  });

  it('a refund of the room line reduces what is left, and does not count as money in', () => {
    const pair = stayMoneyPair(
      [{ amount: 230, qty: 1, revenueCodeId: 'room' }],
      [
        { id: 'p1', amount: 3000, kind: 'PAYMENT', revenueCodeId: 'room' },
        { id: 'r1', amount: 500, kind: 'REFUND', refundOfPaymentId: 'p1', revenueCodeId: 'room' },
      ],
    );
    expect(pair).toEqual({ debt: 0, unused: 2270 });
  });

  it('an untagged settlement payment covers open debt', () => {
    const pair = stayMoneyPair(
      [{ amount: 100, qty: 1, revenueCodeId: 'med' }],
      [{ id: 'g', amount: 100, kind: 'PAYMENT' }],
    );
    expect(pair).toEqual({ debt: 0, unused: 0 });
  });
});
