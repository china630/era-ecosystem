jest.mock('@/lib/prisma', () => ({
  prisma: {
    hotelProfile: { findFirst: jest.fn() },
    businessDay: { findFirst: jest.fn() },
  },
}));

import { bakuCivilUtcDate, todayBakuYmd } from '@era/satellite-kit/time';
import { hotelDateKey } from '@/lib/hotel-calendar';
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
