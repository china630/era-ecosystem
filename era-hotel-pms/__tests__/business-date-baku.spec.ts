jest.mock('@/lib/prisma', () => ({
  prisma: {
    hotelProfile: { findFirst: jest.fn() },
    businessDay: { findFirst: jest.fn() },
  },
}));

import { bakuCivilUtcDate, todayBakuYmd } from '@era/satellite-kit/time';
import { hotelDateKey, hotelNightBounds, stayOccupiesHotelNight } from '@/lib/hotel-calendar';
import { prisma } from '@/lib/prisma';
import {
  getBusinessDateStatus,
  getCurrentBusinessDate,
} from '@/lib/services/business-date.service';

describe('hotel business date (Asia/Baku)', () => {
  const asOf = new Date('2026-09-21T20:30:00.000Z');

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(asOf);
    jest.mocked(prisma.hotelProfile.findFirst).mockResolvedValue(null);
    jest.mocked(prisma.businessDay.findFirst).mockResolvedValue(null);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('todayBakuYmd and hotelDateKey agree at Baku midnight rollover', () => {
    expect(todayBakuYmd(asOf)).toBe('2026-09-22');
    expect(hotelDateKey(asOf)).toBe('2026-09-22');
  });

  it('getCurrentBusinessDate falls back to Baku civil today when profile and open day missing', async () => {
    const biz = await getCurrentBusinessDate();
    expect(biz.toISOString()).toBe('2026-09-22T00:00:00.000Z');
    expect(biz).toEqual(bakuCivilUtcDate('2026-09-22'));
  });

  it('getBusinessDateStatus wall clock uses Baku civil today', async () => {
    const status = await getBusinessDateStatus();
    expect(status.wallClockDate).toBe('2026-09-22');
    expect(status.currentBusinessDate).toBe('2026-09-22');
  });
});

describe('hotel night bounds (door occupancy)', () => {
  it('is [12:00 Baku, next 12:00) so 12:00 checkout is turnover', () => {
    const { start, end } = hotelNightBounds('2026-10-16');
    expect(start.toISOString()).toBe('2026-10-16T08:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-17T08:00:00.000Z');
    expect(
      stayOccupiesHotelNight(
        new Date('2026-10-06T10:00:00.000Z'),
        new Date('2026-10-16T08:00:00.000Z'),
        '2026-10-16',
      ),
    ).toBe(false);
    expect(
      stayOccupiesHotelNight(
        new Date('2026-10-06T10:00:00.000Z'),
        new Date('2026-10-16T08:00:00.000Z'),
        '2026-10-15',
      ),
    ).toBe(true);
  });

  it('a civil date at UTC midnight does not occupy the previous hotel night', () => {
    expect(
      stayOccupiesHotelNight(
        new Date('2026-10-27T00:00:00.000Z'),
        new Date('2026-10-28T00:00:00.000Z'),
        '2026-10-26',
      ),
    ).toBe(false);
    expect(
      stayOccupiesHotelNight(
        new Date('2026-10-27T00:00:00.000Z'),
        new Date('2026-10-28T00:00:00.000Z'),
        '2026-10-27',
      ),
    ).toBe(true);
  });
});
