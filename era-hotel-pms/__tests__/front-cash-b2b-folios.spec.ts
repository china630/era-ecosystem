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
});
