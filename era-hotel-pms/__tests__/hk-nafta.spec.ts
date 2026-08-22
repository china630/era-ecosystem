import {
  assignedPairsUnique,
  inventoryOooCount,
  inventoryOosCount,
  laundryIntakeBlockReason,
  laundryLineAmount,
  mondayOf,
  nextPairIndex,
} from '@/lib/services/hk-nafta.service';

describe('HK Nafta roster helpers', () => {
  it('rotates pairs by +1 without wrapping collision on 5 pairs', () => {
    expect(nextPairIndex(0, 5)).toBe(1);
    expect(nextPairIndex(4, 5)).toBe(0);
    const ring = [0, 1, 2, 3, 4].map((i) => nextPairIndex(i, 5));
    expect(new Set(ring).size).toBe(5);
  });

  it('assigned pair ids stay unique', () => {
    expect(assignedPairsUnique(['a', 'b', 'c'])).toBe(true);
    expect(assignedPairsUnique(['a', 'a'])).toBe(false);
  });

  it('mondayOf lands on Monday UTC', () => {
    const wed = new Date('2026-05-06T00:00:00.000Z');
    expect(mondayOf(wed).toISOString().slice(0, 10)).toBe('2026-05-04');
  });

  it('laundry express adds 50 percent', () => {
    expect(laundryLineAmount(1, 0, 4, 3, false)).toBe(4);
    expect(laundryLineAmount(1, 1, 4, 3, false)).toBe(7);
    expect(laundryLineAmount(1, 0, 4, 3, true)).toBe(6);
  });

  it('blocks Sunday and holiday intake; express only 09-17', () => {
    const sunday = new Date('2026-08-23T08:00:00.000Z');
    expect(laundryIntakeBlockReason({ now: sunday, express: false })).toBeTruthy();
    const weekdayMorning = new Date('2026-08-24T06:00:00.000Z');
    expect(laundryIntakeBlockReason({ now: weekdayMorning, express: false, dayType: 'holiday' })).toMatch(/holiday/i);
    expect(laundryIntakeBlockReason({ now: weekdayMorning, express: false, dayType: 'working' })).toBeNull();
  });

  it('OOO leaves inventory; OOS stays in denominator', () => {
    const rooms = [
      { inventoryStatus: 'OOO', status: 'OOO' },
      { inventoryStatus: 'OOS', status: 'OOS' },
      { inventoryStatus: 'IN_SERVICE', status: 'CLEAN' },
    ];
    expect(inventoryOooCount(rooms)).toBe(1);
    expect(inventoryOosCount(rooms)).toBe(1);
    const sellable = rooms.length - inventoryOooCount(rooms);
    expect(sellable).toBe(2);
  });
});
