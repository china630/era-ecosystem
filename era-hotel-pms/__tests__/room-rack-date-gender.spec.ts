import { hotelDateKey, stayTouchesHotelDate } from '@/lib/hotel-calendar';
import {
  computeRackDisplayState,
  formatSharePoolBadge,
  pickRackStayForDate,
} from '@/lib/room-rack-display';
import { normalizeShareGender } from '@/lib/share-gender';

describe('rack stay vs filter date', () => {
  const june = {
    status: 'CONFIRMED' as const,
    checkInDate: '2026-06-03T10:00:00.000Z',
    checkOutDate: '2026-06-10T08:00:00.000Z',
  };
  const sep = {
    status: 'IN_HOUSE' as const,
    checkInDate: '2026-09-01T10:00:00.000Z',
    checkOutDate: '2026-09-12T08:00:00.000Z',
  };

  it('stayTouchesHotelDate excludes past June stays from September 5', () => {
    expect(stayTouchesHotelDate(june.checkInDate, june.checkOutDate, '2026-09-05')).toBe(
      false,
    );
    expect(stayTouchesHotelDate(sep.checkInDate, sep.checkOutDate, '2026-09-05')).toBe(true);
  });

  it('pickRackStayForDate does not show a non-overlapping CONFIRMED stay', () => {
    expect(pickRackStayForDate([june], '2026-09-05')).toBeUndefined();
    expect(pickRackStayForDate([june, sep], '2026-09-05')?.status).toBe('IN_HOUSE');
  });

  it('AVAILABLE door with only a past CONFIRMED stay is vacant on the filter date', () => {
    expect(
      computeRackDisplayState(
        { status: 'AVAILABLE', reservations: [june] },
        '2026-09-05',
      ),
    ).toBe('vacant');
  });

  it('IN_HOUSE overlapping the filter date is occupied', () => {
    expect(
      computeRackDisplayState({ status: 'AVAILABLE', reservations: [sep] }, '2026-09-05'),
    ).toBe('occupied');
  });

  it('date range 8–11 Sep keeps Sep stay and drops June', () => {
    expect(pickRackStayForDate([sep], '2026-09-08', '2026-09-11')?.status).toBe('IN_HOUSE');
    expect(pickRackStayForDate([june], '2026-09-08', '2026-09-11')).toBeUndefined();
  });
});

describe('share gender on rack', () => {
  it('maps EW 0/1 codes instead of treating 0 as female', () => {
    expect(normalizeShareGender('0')).toBe('M');
    expect(normalizeShareGender('1')).toBe('F');
    expect(formatSharePoolBadge({ gender: '0', occupied: 1, capacity: 2 }).gender).toBe('M');
    expect(formatSharePoolBadge({ gender: '1', occupied: 1, capacity: 2 }).gender).toBe('F');
  });

  it('hotelDateKey keeps YYYY-MM-DD keys', () => {
    expect(hotelDateKey('2026-09-05')).toBe('2026-09-05');
  });
});
