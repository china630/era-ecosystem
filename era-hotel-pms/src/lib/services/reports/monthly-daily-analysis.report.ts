import { prisma } from '@/lib/prisma';
import { queryOccupancyDays } from './occupancy-days';

export interface MonthlyDailyRow {
  date: string;
  roomsSold: number;
  roomsAvailable: number;
  occupancyPct: number;
  revenue: number;
  adr: number;
  revPar: number;
}

export async function queryMonthlyDailyAnalysis(
  monthStart: Date,
  businessDate: Date,
): Promise<MonthlyDailyRow[]> {
  const profile = await prisma.hotelProfile.findFirst({ select: { roomCapacity: true } });
  const rooms = await prisma.room.findMany({
    where: { deleted: false, disabled: false },
    select: { status: true, inventoryStatus: true },
  });

  const totalRooms = profile?.roomCapacity ?? rooms.length;
  const oooCount = rooms.filter((r) => r.inventoryStatus === 'OOO' || (!r.inventoryStatus && r.status === 'OOO')).length;
  const sellable = totalRooms - oooCount;

  const startIso = monthStart.toISOString().slice(0, 10);
  const endIso = businessDate.toISOString().slice(0, 10);
  const days = await queryOccupancyDays(startIso, endIso);

  return days.map((day) => {
    const occupancyPct = sellable > 0 ? Math.round((day.roomsSold / sellable) * 1000) / 10 : 0;
    const adr = day.roomsSold > 0 ? Math.round((day.revenue / day.roomsSold) * 100) / 100 : 0;
    const revPar = sellable > 0 ? Math.round((day.revenue / sellable) * 100) / 100 : 0;
    return {
      date: day.day,
      roomsSold: day.roomsSold,
      roomsAvailable: sellable,
      occupancyPct,
      revenue: Math.round(day.revenue * 100) / 100,
      adr,
      revPar,
    };
  });
}
