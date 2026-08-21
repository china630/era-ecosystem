import { prisma } from '@/lib/prisma';

export interface ThreeYearOccRow {
  month: string;
  y0: { year: number; occPct: number; roomsSold: number };
  y1: { year: number; occPct: number; roomsSold: number };
  y2: { year: number; occPct: number; roomsSold: number };
}

export interface ThreeYearRevRow {
  month: string;
  y0: { year: number; revenue: number };
  y1: { year: number; revenue: number };
  y2: { year: number; revenue: number };
}

function monthKey(d: Date): string {
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function yearStart(year: number): Date {
  return new Date(Date.UTC(year, 0, 1));
}

async function sellableRooms(): Promise<number> {
  const profile = await prisma.hotelProfile.findFirst({ select: { roomCapacity: true } });
  if (profile?.roomCapacity && profile.roomCapacity > 0) return profile.roomCapacity;
  return prisma.room.count({ where: { deleted: false, disabled: false } });
}

export async function queryThreeYearOcc(_from: Date, to: Date): Promise<ThreeYearOccRow[]> {
  const endYear = to.getUTCFullYear();
  const years = [endYear, endYear - 1, endYear - 2];
  const sellable = await sellableRooms();
  const rangeStart = yearStart(years[2]);
  const rangeEnd = new Date(Date.UTC(endYear, to.getUTCMonth() + 1, 1));

  const reservations = await prisma.reservation.findMany({
    where: {
      status: { in: ['CONFIRMED', 'IN_HOUSE', 'CHECKED_OUT'] },
      checkInDate: { lt: rangeEnd },
      checkOutDate: { gt: rangeStart },
    },
    select: { checkInDate: true, checkOutDate: true },
  });

  const sold = new Map<string, number>();
  for (const r of reservations) {
    const cursor = new Date(r.checkInDate);
    cursor.setUTCHours(0, 0, 0, 0);
    const end = new Date(r.checkOutDate);
    while (cursor < end && cursor < rangeEnd) {
      if (cursor >= rangeStart) {
        const key = `${cursor.getUTCFullYear()}-${monthKey(cursor)}`;
        sold.set(key, (sold.get(key) ?? 0) + 1);
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  const daysIn = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

  return months.map((month) => {
    const cell = (year: number) => {
      const roomsSold = sold.get(`${year}-${month}`) ?? 0;
      const avail = sellable * daysIn(year, Number(month));
      const occPct = avail > 0 ? Math.round((roomsSold / avail) * 1000) / 10 : 0;
      return { year, occPct, roomsSold };
    };
    return { month, y0: cell(years[0]), y1: cell(years[1]), y2: cell(years[2]) };
  });
}

export async function queryThreeYearRev(_from: Date, to: Date): Promise<ThreeYearRevRow[]> {
  const endYear = to.getUTCFullYear();
  const years = [endYear, endYear - 1, endYear - 2];
  const rangeStart = yearStart(years[2]);
  const rangeEnd = new Date(Date.UTC(endYear, to.getUTCMonth() + 1, 1));

  const charges = await prisma.folioCharge.findMany({
    where: { businessDate: { gte: rangeStart, lt: rangeEnd } },
    select: { amount: true, businessDate: true },
  });

  const rev = new Map<string, number>();
  for (const c of charges) {
    const key = `${c.businessDate.getUTCFullYear()}-${monthKey(c.businessDate)}`;
    rev.set(key, (rev.get(key) ?? 0) + Number(c.amount));
  }

  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  return months.map((month) => ({
    month,
    y0: { year: years[0], revenue: rev.get(`${years[0]}-${month}`) ?? 0 },
    y1: { year: years[1], revenue: rev.get(`${years[1]}-${month}`) ?? 0 },
    y2: { year: years[2], revenue: rev.get(`${years[2]}-${month}`) ?? 0 },
  }));
}
