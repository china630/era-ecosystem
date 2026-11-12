import { readFileSync } from 'fs';
import { join } from 'path';
import { handleRouteError } from '@/lib/api-utils';

describe('tours API negatives', () => {
  it('maps IN_HOUSE rule from service', async () => {
    const src = readFileSync(
      join(__dirname, '../nest/generated/tours_departures__id_bookings.ts'),
      'utf8',
    );
    expect(src).toContain('addTourBooking');
    expect(src).toContain('sendRouteError');
    const res = handleRouteError(new Error('Guest must be IN_HOUSE'));
    expect(res.status).toBe(400);
  });
});
