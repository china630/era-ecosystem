import { computeGuestFolioBalance } from '../src/components/reservation-card/folio-balance';
import { folioArticleSummary } from '../src/lib/folio-article-summary';
import { parseRoomChargeNote, roomChargeNote } from '../src/lib/folio-charge-note';

describe('folio desk money', () => {
  it('nets refunds and skips voided payments', () => {
    const balance = computeGuestFolioBalance([
      {
        type: 'GUEST',
        charges: [{ amount: 478, qty: 1 }, { amount: 478, qty: 1 }],
        payments: [
          { amount: 478, kind: 'PAYMENT' },
          { amount: 478, kind: 'PAYMENT' },
          { amount: 478, kind: 'REFUND' },
          { amount: 478, kind: 'REFUND' },
          { amount: 100, kind: 'PAYMENT', voidedAt: '2026-10-14' },
        ],
      },
    ]);
    expect(balance).toBe(956);
  });

  it('spreads a lump payment from the oldest article', () => {
    const summary = folioArticleSummary({
      locale: 'en',
      charges: [
        { id: 'a', amount: 100, businessDate: '2026-10-07', revenueCode: { code: 'ROOM', name: 'Room' } },
        { id: 'b', amount: 80, businessDate: '2026-10-08', revenueCode: { code: 'ROOM', name: 'Room' } },
      ],
      payments: [{ amount: 100, kind: 'PAYMENT' }],
    });
    expect(summary.charged).toBe(180);
    expect(summary.paid).toBe(100);
    expect(summary.debt).toBe(80);
    expect(summary.rows).toEqual([
      { key: 'ROOM', label: 'Room', charged: 180, paid: 100, debt: 80 },
    ]);
  });

  it('reads structured night notes and legacy English', () => {
    expect(parseRoomChargeNote(roomChargeNote('night-audit', '2026-10-07'))).toEqual({
      kind: 'night-audit',
      date: '2026-10-07',
    });
    expect(parseRoomChargeNote('Room charge 2026-10-08')).toEqual({
      kind: 'manual-room',
      date: '2026-10-08',
    });
    expect(parseRoomChargeNote('laundry')).toBeNull();
  });
});
