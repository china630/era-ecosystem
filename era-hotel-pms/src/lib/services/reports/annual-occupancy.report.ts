import { prisma } from '@/lib/prisma';
import { queryOccupancyDays } from './occupancy-days';

export interface AnnualOccupancyRow {
  month: string;
  roomsAvailable: number;
  roomsSold: number;
  occupancyPct: number;
  revenue: number;
  adr: number;
  revPar: number;
}

export async function queryAnnualOccupancy(
  yearStart: Date,
  businessDate: Date,
): Promise<AnnualOccupancyRow[]> {
  const profile = await prisma.hotelProfile.findFirst({ select: { roomCapacity: true } });
  const rooms = await prisma.room.findMany({
    where: { deleted: false, disabled: false },
    select: { status: true, inventoryStatus: true },
  });

  const totalRooms = profile?.roomCapacity ?? rooms.length;
  const oooCount = rooms.filter((r) => r.inventoryStatus === 'OOO' || (!r.inventoryStatus && r.status === 'OOO')).length;
  const sellable = totalRooms - oooCount;

  const startIso = yearStart.toISOString().slice(0, 10);
  const endIso = businessDate.toISOString().slice(0, 10);
  const days = await queryOccupancyDays(startIso, endIso);

  const byMonth = new Map<string, { days: number; roomsSold: number; revenue: number }>();
  for (const day of days) {
    const month = day.day.slice(0, 7);
    const row = byMonth.get(month) ?? { days: 0, roomsSold: 0, revenue: 0 };
    row.days += 1;
    row.roomsSold += day.roomsSold;
    row.revenue += day.revenue;
    byMonth.set(month, row);
  }

  return [...byMonth.entries()].map(([month, row]) => {
    const roomsAvailable = sellable * row.days;
    const occupancyPct = roomsAvailable > 0 ? Math.round((row.roomsSold / roomsAvailable) * 1000) / 10 : 0;
    const adr = row.roomsSold > 0 ? Math.round((row.revenue / row.roomsSold) * 100) / 100 : 0;
    const revPar = roomsAvailable > 0 ? Math.round((row.revenue / roomsAvailable) * 100) / 100 : 0;
    return {
      month,
      roomsAvailable,
      roomsSold: row.roomsSold,
      occupancyPct,
      revenue: Math.round(row.revenue * 100) / 100,
      adr,
      revPar,
    };
  });
}
