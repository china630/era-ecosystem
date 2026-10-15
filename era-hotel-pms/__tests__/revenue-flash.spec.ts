import { revenueFlashBucket } from '../src/lib/services/executive-cockpit.helpers';

describe('revenueFlashBucket', () => {
  it('keeps airport TRANSFER in room and guest TOUR in other', () => {
    expect(revenueFlashBucket({ systemRole: 'TRANSFER' }, 'ACC')).toBe('room');
    expect(revenueFlashBucket({ systemRole: 'TOUR' }, 'ACC')).toBe('other');
  });

  it('keeps city tax out of room revenue', () => {
    expect(revenueFlashBucket({ systemRole: 'CITY_TAX' }, 'ACC')).toBe('other');
  });

  it('buckets a code with no role by its department', () => {
    expect(revenueFlashBucket({ systemRole: null }, 'MED')).toBe('medical');
    expect(revenueFlashBucket({ systemRole: null }, 'REST')).toBe('fb');
    expect(revenueFlashBucket({ systemRole: null }, null)).toBe('other');
  });
});
