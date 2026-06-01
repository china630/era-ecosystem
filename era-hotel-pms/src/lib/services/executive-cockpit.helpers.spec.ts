import {
  computeHotelStatus,
  occupancyDeviationPct,
  revenueFlashBucket,
} from './executive-cockpit.helpers';

describe('executive-cockpit helpers', () => {
  it('classifies revenue codes into flash buckets', () => {
    expect(revenueFlashBucket('ROOM', 'ACC')).toBe('room');
    expect(revenueFlashBucket('FOOD', 'REST')).toBe('fb');
    expect(revenueFlashBucket('TREATMENT', 'MED')).toBe('spa');
    expect(revenueFlashBucket('MEDICAL', 'MED')).toBe('medical');
  });

  it('computes occupancy deviation in percentage points', () => {
    expect(occupancyDeviationPct(72, 80)).toBe(-8);
    expect(occupancyDeviationPct(85, 80)).toBe(5);
  });

  it('assigns hotel status from thresholds', () => {
    expect(
      computeHotelStatus({
        occupancyFactPct: 70,
        occupancyDeviationPct: 2,
        overdueBalance: 1000,
        totalReceivable: 5000,
      }),
    ).toBe('NORMAL');
    expect(
      computeHotelStatus({
        occupancyFactPct: 45,
        occupancyDeviationPct: -5,
        overdueBalance: 5000,
        totalReceivable: 10000,
      }),
    ).toBe('RISK');
    expect(
      computeHotelStatus({
        occupancyFactPct: 20,
        occupancyDeviationPct: -20,
        overdueBalance: 30000,
        totalReceivable: 40000,
      }),
    ).toBe('CRITICAL');
  });
});
