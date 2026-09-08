import { describe, expect, it } from '@jest/globals';
import { parsePendingReceiptLines } from '@/lib/pending-receipt-lines';
import { passesFolioBalanceTab } from '@/lib/services/folio-balances.service';
import { sumFolioTypeActivity } from '@/lib/services/agency-ledger.service';
import { toDecimal } from '@/lib/decimal';

describe('parsePendingReceiptLines', () => {
  it('splits F&B outlet lines with qty x name', () => {
    const lines = parsePendingReceiptLines('FB LOBBY: 2x Tea; 1x Pizza');
    expect(lines).toEqual([
      { qty: 2, name: 'Tea' },
      { qty: 1, name: 'Pizza' },
    ]);
  });

  it('treats clinic sentence as a single line', () => {
    expect(parsePendingReceiptLines('Visit exam extra')).toEqual([
      { qty: 1, name: 'Visit exam extra' },
    ]);
  });
});

describe('passesFolioBalanceTab', () => {
  it('inHouse keeps zero-balance stays', () => {
    expect(passesFolioBalanceTab('inHouse', 0, 0, 0)).toBe(true);
  });

  it('inHouseBalanced drops fully settled stays', () => {
    expect(passesFolioBalanceTab('inHouseBalanced', 0, 0, 0)).toBe(false);
    expect(passesFolioBalanceTab('inHouseBalanced', 0, 12, 0)).toBe(true);
  });

  it('inHouseGuestBalanced requires guest folio balance', () => {
    expect(passesFolioBalanceTab('inHouseGuestBalanced', 0, 40, 0)).toBe(false);
    expect(passesFolioBalanceTab('inHouseGuestBalanced', 5, 0, 0)).toBe(true);
  });
});

describe('city ledger folio type split', () => {
  const from = new Date('2026-09-01');
  const to = new Date('2026-09-07T23:59:59.999Z');
  const folios = [
    {
      type: 'AGENCY',
      charges: [{ amount: toDecimal(100), qty: 1, businessDate: new Date('2026-09-02') }],
      payments: [],
    },
    {
      type: 'COMPANY',
      charges: [{ amount: toDecimal(50), qty: 1, businessDate: new Date('2026-09-02') }],
      payments: [],
    },
  ];

  it('agency ledger ignores COMPANY folio charges', () => {
    expect(sumFolioTypeActivity(folios, 'AGENCY', from, to).newCharges).toBe(100);
  });

  it('company ledger ignores AGENCY folio charges', () => {
    expect(sumFolioTypeActivity(folios, 'COMPANY', from, to).newCharges).toBe(50);
  });

  it('treats REFUND as negative net payment (increases debt)', () => {
    const withRefund = [
      {
        type: 'AGENCY' as const,
        charges: [{ amount: toDecimal(100), qty: 1, businessDate: new Date('2026-09-02') }],
        payments: [
          {
            amount: toDecimal(40),
            paymentMethod: 'COMPANY_ACCOUNT',
            createdAt: new Date('2026-09-03'),
            kind: 'PAYMENT',
          },
          {
            amount: toDecimal(10),
            paymentMethod: 'COMPANY_ACCOUNT',
            createdAt: new Date('2026-09-04'),
            kind: 'REFUND',
          },
        ],
      },
    ];
    const slice = sumFolioTypeActivity(withRefund, 'AGENCY', from, to);
    expect(slice.newCharges).toBe(100);
    expect(slice.payments).toBe(30);
    expect(slice.opening + slice.newCharges - slice.payments).toBe(70);
  });

  it('opening includes prior stay activity (not stay-overlap only)', () => {
    const prior = [
      {
        type: 'AGENCY' as const,
        charges: [{ amount: toDecimal(80), qty: 1, businessDate: new Date('2026-08-15') }],
        payments: [
          {
            amount: toDecimal(20),
            paymentMethod: 'CASH',
            createdAt: new Date('2026-08-20'),
            kind: 'PAYMENT',
          },
        ],
      },
    ];
    const slice = sumFolioTypeActivity(prior, 'AGENCY', from, to);
    expect(slice.opening).toBe(60);
    expect(slice.newCharges).toBe(0);
    expect(slice.payments).toBe(0);
  });
});
