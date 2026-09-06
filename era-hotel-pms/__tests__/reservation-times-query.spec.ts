import { describe, expect, it } from '@jest/globals';
import { buildReservationTimesWhere } from '@/lib/services/reports.service';

describe('reservation times query', () => {
  it('requires actual CI or CO in the date window and sorts newest CI first (caller)', () => {
    const where = buildReservationTimesWhere({
      from: new Date('2026-09-01T12:00:00'),
      to: new Date('2026-09-06T12:00:00'),
    });
    expect(where.stay.is.OR).toHaveLength(2);
    expect(where.stay.is.OR[0]!.actualCheckIn).toBeDefined();
    expect(where.stay.is.OR[1]!.actualCheckOut).toBeDefined();
    expect(where).not.toHaveProperty('guest');
  });

  it('filters guest FIO and agency name/code', () => {
    const where = buildReservationTimesWhere({
      from: new Date('2026-09-01'),
      to: new Date('2026-09-06'),
      guestQ: '  Molotkova ',
      agencyQ: 'Mani',
    });
    expect(where.guest.is.fullName.contains).toBe('Molotkova');
    expect(where.agency.is.OR[0]!.name.contains).toBe('Mani');
    expect(where.agency.is.OR[1]!.code.contains).toBe('Mani');
  });
});
