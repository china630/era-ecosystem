import { revenueFlashBucket } from '../src/lib/services/executive-cockpit.helpers';

describe('revenueFlashBucket', () => {
  it('keeps airport TRANSFER in room and guest TOUR in other', () => {
    expect(revenueFlashBucket('TRANSFER', 'ACC')).toBe('room');
    expect(revenueFlashBucket('TOUR', 'ACC')).toBe('other');
  });
});
