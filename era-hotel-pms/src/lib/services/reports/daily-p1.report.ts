import { prisma } from '@/lib/prisma';
import { queryDailyManagement, type DailyManagementData } from './daily-management.report';

// ── daily-management-summary ──

export interface DailyManagementSummaryData {
  businessDate: string;
  totalRooms: number;
  occupied: number;
  occupancyPct: number;
  avgRate: number;
  revPar: number;
  totalRevenue: number;
  arrivals: number;
  departures: number;
}

export async function queryDailyManagementSummary(businessDate: Date): Promise<DailyManagementSummaryData> {
  const full = await queryDailyManagement(businessDate);
  const totalRevenue = full.revenueSummary.reduce((s, r) => s + r.total, 0);
  return {
    businessDate: full.businessDate,
    totalRooms: full.roomStats.totalRooms,
    occupied: full.roomStats.occupied,
    occupancyPct: full.roomStats.occupancyPct,
    avgRate: full.roomStats.avgRate,
    revPar: full.roomStats.revPar,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    arrivals: full.arrivals,
    departures: full.departures,
  };
}

// ── main-current (today's snapshot) ──

export interface MainCurrentData extends DailyManagementData {
  inHouseDetails: {
    guestName: string;
    roomNumber: string | null;
    checkIn: string;
    checkOut: string;
    roomType: string;
  }[];
}

export async function queryMainCurrent(businessDate: Date): Promise<MainCurrentData> {
  const full = await queryDailyManagement(businessDate);
  const dateIso = businessDate.toISOString().slice(0, 10);
  const dayStart = new Date(`${dateIso}T00:00:00.000Z`);
  const dayEnd = new Date(`${dateIso}T23:59:59.999Z`);

  const inHouseRes = await prisma.reservation.findMany({
    where: {
      status: 'IN_HOUSE',
      checkInDate: { lte: dayEnd },
      checkOutDate: { gt: dayStart },
    },
    select: {
      guest: { select: { fullName: true } },
      room: { select: { roomNumber: true } },
      roomType: { select: { name: true } },
      checkInDate: true,
      checkOutDate: true,
    },
    orderBy: { room: { roomNumber: 'asc' } },
  });

  return {
    ...full,
    inHouseDetails: inHouseRes.map((r) => ({
      guestName: r.guest.fullName,
      roomNumber: r.room?.roomNumber ?? null,
      checkIn: r.checkInDate.toISOString().slice(0, 10),
      checkOut: r.checkOutDate.toISOString().slice(0, 10),
      roomType: r.roomType.name,
    })),
  };
}

// ── date-range-management ──

export interface DateRangeManagementData {
  days: DailyManagementData[];
}

export async function queryDateRangeManagement(from: Date, to: Date): Promise<DateRangeManagementData> {
  const days: DailyManagementData[] = [];
  const cursor = new Date(from);
  const end = new Date(to);
  end.setUTCDate(end.getUTCDate() + 1);

  while (cursor < end) {
    days.push(await queryDailyManagement(new Date(cursor)));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return { days };
}
