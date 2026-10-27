import { compareFloorSheetRows } from '@/lib/hk-sheet-sort';
import { laundryTicketAmount } from '@/lib/laundry-pieces';

describe('HK floor sheet soft sort', () => {
  it('orders departure before stay, VIP before non-VIP, then needed-by, dirty, duty, room#', () => {
    const rows = [
      { roomNumber: '305', jobDuty: 'LINEN', vip: '', hkCondition: 'CLEAN', neededByAt: null },
      { roomNumber: '201', jobDuty: 'DEPARTURE', vip: '', hkCondition: 'DIRTY', neededByAt: null },
      { roomNumber: '202', jobDuty: 'DEPARTURE', vip: 'VIP', hkCondition: 'CLEAN', neededByAt: null },
      { roomNumber: '203', jobDuty: 'DEPARTURE', vip: '', hkCondition: 'CLEAN', neededByAt: '2026-08-24T10:00:00.000Z' },
      { roomNumber: '204', jobDuty: 'DEPARTURE', vip: '', hkCondition: 'DIRTY', neededByAt: '2026-08-24T12:00:00.000Z' },
      { roomNumber: '101', jobDuty: 'LINEN', vip: '', hkCondition: 'CLEAN', neededByAt: null },
    ];
    const sorted = [...rows].sort(compareFloorSheetRows).map((r) => r.roomNumber);
    expect(sorted).toEqual(['202', '203', '204', '201', '101', '305']);
  });
});

describe('laundryTicketAmount', () => {
  it('sums wash and iron from catalog prices', () => {
    expect(
      laundryTicketAmount([
        { washQty: 2, ironQty: 1, item: { washPrice: 4, ironPrice: 3 } },
        { washQty: 0, ironQty: 2, item: { washPrice: 5, ironPrice: 2.5 } },
      ]),
    ).toBe(16);
  });

  it('applies express surcharge when enabled', () => {
    expect(
      laundryTicketAmount([{ washQty: 1, ironQty: 0, item: { washPrice: 10, ironPrice: 0 } }], {
        express: true,
        expressPercent: 50,
      }),
    ).toBe(15);
  });

  it('returns 0 for empty lines', () => {
    expect(laundryTicketAmount(undefined)).toBe(0);
    expect(laundryTicketAmount([])).toBe(0);
  });
});
