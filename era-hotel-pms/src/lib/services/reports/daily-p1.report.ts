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
  const startIso = from.toISOString().slice(0, 10);
  const endIso = to.toISOString().slice(0, 10);
  const windowStart = new Date(`${startIso}T00:00:00.000Z`);
  const windowEnd = new Date(`${endIso}T00:00:00.000Z`);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 1);

  const [rooms, reservations, charges, profile] = await Promise.all([
    prisma.room.findMany({
      where: { deleted: false, disabled: false },
      select: { status: true, inventoryStatus: true },
    }),
    prisma.reservation.findMany({
      where: {
        status: { in: ['CONFIRMED', 'IN_HOUSE', 'CHECKED_OUT'] },
        checkInDate: { lt: windowEnd },
        checkOutDate: { gt: windowStart },
      },
      select: { status: true, checkInDate: true, checkOutDate: true, accomType: true },
    }),
    prisma.folioCharge.findMany({
      where: { businessDate: { gte: windowStart, lt: windowEnd } },
      select: {
        amount: true,
        businessDate: true,
        department: { select: { code: true, name: true } },
        revenueCode: { select: { department: { select: { code: true, name: true } } } },
      },
    }),
    prisma.hotelProfile.findFirst({ select: { roomCapacity: true } }),
  ]);

  const totalRooms = profile?.roomCapacity ?? rooms.length;
  const ooo = rooms.filter((r) => r.inventoryStatus === 'OOO' || (!r.inventoryStatus && r.status === 'OOO')).length;
  const oos = rooms.filter((r) => r.inventoryStatus === 'OOS' || (!r.inventoryStatus && r.status === 'OOS')).length;
  const sellableRooms = totalRooms - ooo;

  type DayAcc = {
    occupied: number;
    complimentary: number;
    houseUse: number;
    arrivals: number;
    departures: number;
    roomRevenue: number;
    depts: Map<string, { departmentCode: string; departmentName: string; total: number }>;
  };
  const byDay = new Map<number, DayAcc>();
  const startMs = windowStart.getTime();
  const endMs = windowEnd.getTime();
  const ensure = (ms: number): DayAcc => {
    let row = byDay.get(ms);
    if (!row) {
      row = {
        occupied: 0,
        complimentary: 0,
        houseUse: 0,
        arrivals: 0,
        departures: 0,
        roomRevenue: 0,
        depts: new Map(),
      };
      byDay.set(ms, row);
    }
    return row;
  };
  const utcDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  for (let ms = startMs; ms < endMs; ms += 86_400_000) ensure(ms);

  for (const r of reservations) {
    const inMs = utcDay(r.checkInDate);
    if (inMs >= startMs && inMs < endMs) ensure(inMs).arrivals += 1;
    const outMs = utcDay(r.checkOutDate);
    if (outMs >= startMs && outMs < endMs) ensure(outMs).departures += 1;
    let lastExclusive = outMs;
    if (r.checkOutDate.getTime() > outMs) lastExclusive += 86_400_000;
    const first = Math.max(inMs, startMs);
    lastExclusive = Math.min(lastExclusive, endMs);
    for (let night = first; night < lastExclusive; night += 86_400_000) {
      const row = ensure(night);
      row.occupied += 1;
      if (r.accomType === 'COMP') row.complimentary += 1;
      if (r.accomType === 'HOUSE') row.houseUse += 1;
    }
  }

  for (const c of charges) {
    const ms = utcDay(c.businessDate);
    if (ms < startMs || ms >= endMs) continue;
    const row = ensure(ms);
    const dept = c.department ?? c.revenueCode?.department;
    const departmentCode = dept?.code ?? 'OTHER';
    const amount = Number(c.amount);
    if (departmentCode === 'ROOM' || departmentCode === 'ROOMS') row.roomRevenue += amount;
    const existing = row.depts.get(departmentCode);
    if (existing) existing.total += amount;
    else row.depts.set(departmentCode, { departmentCode, departmentName: dept?.name ?? 'Other', total: amount });
  }

  const days: DailyManagementData[] = [];
  for (let ms = startMs; ms < endMs; ms += 86_400_000) {
    const row = ensure(ms);
    const date = new Date(ms);
    const dateIso = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
    days.push({
      businessDate: dateIso,
      roomStats: {
        totalRooms,
        occupied: row.occupied,
        vacant: Math.max(sellableRooms - row.occupied, 0),
        ooo,
        oos,
        complimentary: row.complimentary,
        houseUse: row.houseUse,
        occupancyPct: sellableRooms > 0 ? Math.round((row.occupied / sellableRooms) * 1000) / 10 : 0,
        avgRate: row.occupied > 0 ? Math.round((row.roomRevenue / row.occupied) * 100) / 100 : 0,
        revPar: sellableRooms > 0 ? Math.round((row.roomRevenue / sellableRooms) * 100) / 100 : 0,
      },
      revenueSummary: [...row.depts.values()].sort((a, b) => b.total - a.total),
      arrivals: row.arrivals,
      departures: row.departures,
      inHouseGuests: row.occupied,
    });
  }
  return { days };
}
