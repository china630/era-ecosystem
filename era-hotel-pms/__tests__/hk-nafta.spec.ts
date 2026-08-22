import {
  laundryLineAmount,
  mondayOf,
  nextPairIndex,
} from '@/lib/services/hk-nafta.service';

describe('HK Nafta roster helpers', () => {
  it('rotates pairs by +1 without wrapping collision on 5 pairs', () => {
    expect(nextPairIndex(0, 5)).toBe(1);
    expect(nextPairIndex(4, 5)).toBe(0);
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
});
