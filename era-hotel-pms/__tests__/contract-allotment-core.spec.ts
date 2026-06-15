import {
  computeBarPoolAfterContractHold,
  computeContractNightAvailable,
  computeUtilizationPercent,
  eachNight,
} from '@/lib/services/contract-allotment-core';

describe('contract-allotment-core', () => {
  describe('eachNight', () => {
    it('returns one night for single-night stay', () => {
      const nights = eachNight(new Date('2026-06-01'), new Date('2026-06-02'));
      expect(nights).toHaveLength(1);
      expect(nights[0].toISOString().slice(0, 10)).toBe('2026-06-01');
    });

    it('returns empty when check-in equals check-out', () => {
      expect(eachNight(new Date('2026-06-01'), new Date('2026-06-01'))).toHaveLength(0);
    });
  });

  describe('computeContractNightAvailable', () => {
    it('caps availability by contract quota', () => {
      expect(computeContractNightAvailable(20, 18, 10)).toEqual({
        available: 2,
        contractAvailable: 2,
      });
    });

    it('caps availability by room pool when larger than contract remainder', () => {
      expect(computeContractNightAvailable(20, 5, 3)).toEqual({
        available: 3,
        contractAvailable: 15,
      });
    });

    it('returns zero when allotment exhausted', () => {
      expect(computeContractNightAvailable(10, 10, 5).available).toBe(0);
    });
  });

  describe('computeBarPoolAfterContractHold', () => {
    it('reduces BAR pool by held contract rooms minus double-counted contract bookings', () => {
      // base 100, 25 total overlapping, contract quota 20 with 5 booked → held 15, non-contract overlap 20
      expect(computeBarPoolAfterContractHold(100, 25, 20, 5)).toBe(65);
    });

    it('does not go negative when overlap exceeds base quota', () => {
      expect(computeBarPoolAfterContractHold(5, 10, 3, 0)).toBe(0);
    });
  });

  describe('computeUtilizationPercent', () => {
    it('returns null when no allotment nights configured', () => {
      expect(computeUtilizationPercent(0, 5)).toBeNull();
    });

    it('rounds to two decimal places', () => {
      expect(computeUtilizationPercent(3, 1)).toBe(33.33);
    });
  });
});
