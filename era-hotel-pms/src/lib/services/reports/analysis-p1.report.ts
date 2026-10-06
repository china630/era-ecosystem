import { prisma } from '@/lib/prisma';
import { safePct, safeDiv } from '@/lib/reports/ratio';
import { bakuDateKey, bakuDayBounds } from '@era/satellite-kit/time';

function toIso(d: Date): string {
  return bakuDateKey(d);
}

/** Baku midnight as an instant; charge and stay instants are compared against it. */
function dayStart(iso: string): Date {
  return bakuDayBounds(iso).start;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

// ── sales ──

export interface SalesRow {
  sourceCode: string;
  sourceName: string;
  roomNights: number;
  revenue: number;
  avgRate: number | null;
}

export interface SalesResult {
  rows: SalesRow[];
  totalNights: number;
  totalRevenue: number;
}

export async function querySales(from: Date, to: Date): Promise<SalesResult> {
  const windowStart = dayStart(toIso(from));
  const windowEnd = addDays(dayStart(toIso(to)), 1);

  const reservations = await prisma.reservation.findMany({
    where: {
      status: { in: ['CONFIRMED', 'IN_HOUSE', 'CHECKED_OUT'] },
      checkInDate: { lt: windowEnd },
      checkOutDate: { gt: windowStart },
    },
    select: {
      totalAmount: true,
      checkInDate: true,
      checkOutDate: true,
      source: { select: { code: true, name: true } },
    },
  });

  const map = new Map<string, { code: string; name: string; nights: number; revenue: number }>();
  for (const r of reservations) {
    const code = r.source?.code ?? 'DIRECT';
    const name = r.source?.name ?? 'Direct';
    const nights = Math.max(
      Math.min(Number(r.checkOutDate), Number(windowEnd)) - Math.max(Number(r.checkInDate), Number(windowStart)),
      0,
    ) / 86_400_000;
    const roundedNights = Math.round(nights);
    const existing = map.get(code);
    if (existing) {
      existing.nights += roundedNights;
      existing.revenue += Number(r.totalAmount);
    } else {
      map.set(code, { code, name, nights: roundedNights, revenue: Number(r.totalAmount) });
    }
  }

  const rows: SalesRow[] = [...map.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .map((v) => ({
      sourceCode: v.code,
      sourceName: v.name,
      roomNights: v.nights,
      revenue: Math.round(v.revenue * 100) / 100,
      avgRate: safeDiv(v.revenue, v.nights),
    }));

  return {
    rows,
    totalNights: rows.reduce((s, r) => s + r.roomNights, 0),
    totalRevenue: rows.reduce((s, r) => s + r.revenue, 0),
  };
}

// ── distribution ──

export interface DistributionRow {
  segment: string;
  roomNights: number;
  pctOfTotal: number | null;
}

export interface DistributionResult {
  rows: DistributionRow[];
  totalNights: number;
}

export async function queryDistribution(from: Date, to: Date): Promise<DistributionResult> {
  const windowStart = dayStart(toIso(from));
  const windowEnd = addDays(dayStart(toIso(to)), 1);

  const reservations = await prisma.reservation.findMany({
    where: {
      status: { in: ['CONFIRMED', 'IN_HOUSE', 'CHECKED_OUT'] },
      checkInDate: { lt: windowEnd },
      checkOutDate: { gt: windowStart },
    },
    select: { segment: true },
  });

  const segMap = new Map<string, number>();
  for (const r of reservations) {
    const seg = r.segment ?? 'N/A';
    segMap.set(seg, (segMap.get(seg) ?? 0) + 1);
  }

  const totalNights = reservations.length;
  const rows: DistributionRow[] = [...segMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([segment, roomNights]) => ({
      segment,
      roomNights,
      pctOfTotal: safePct(roomNights, totalNights),
    }));

  return { rows, totalNights };
}

// ── quota ──

export interface QuotaRow {
  roomTypeCode: string;
  roomTypeName: string;
  quota: number;
  actualSold: number;
  actualOccPct: number | null;
  variance: number;
}

export interface QuotaResult {
  rows: QuotaRow[];
  totalQuota: number;
  totalSold: number;
}

export async function queryQuota(from: Date, to: Date): Promise<QuotaResult> {
  const windowStart = dayStart(toIso(from));
  const windowEnd = addDays(dayStart(toIso(to)), 1);
  const days = Math.round((windowEnd.getTime() - windowStart.getTime()) / 86_400_000);

  const [roomTypes, reservations] = await Promise.all([
    prisma.roomType.findMany({ where: { active: true }, orderBy: { code: 'asc' } }),
    prisma.reservation.findMany({
      where: {
        status: { in: ['CONFIRMED', 'IN_HOUSE', 'CHECKED_OUT'] },
        checkInDate: { lt: windowEnd },
        checkOutDate: { gt: windowStart },
      },
      select: { roomTypeId: true },
    }),
  ]);

  const countByType = new Map<string, number>();
  for (const r of reservations) {
    countByType.set(r.roomTypeId, (countByType.get(r.roomTypeId) ?? 0) + 1);
  }

  const rows: QuotaRow[] = roomTypes.map((rt) => {
    const quota = rt.baseQuota * days;
    const actualSold = countByType.get(rt.id) ?? 0;
    return {
      roomTypeCode: rt.code,
      roomTypeName: rt.name,
      quota,
      actualSold,
      actualOccPct: safePct(actualSold, quota),
      variance: actualSold - quota,
    };
  });

  return {
    rows,
    totalQuota: rows.reduce((s, r) => s + r.quota, 0),
    totalSold: rows.reduce((s, r) => s + r.actualSold, 0),
  };
}

// ── manager-view ──

export interface ManagerViewResult {
  dateFrom: string;
  dateTo: string;
  totalRooms: number;
  sellableRooms: number;
  totalReservations: number;
  occupancyPct: number | null;
  totalRevenue: number;
  adr: number | null;
  revPar: number | null;
  arrivals: number;
  departures: number;
  cancellations: number;
  avgLos: number | null;
}

export async function queryManagerView(from: Date, to: Date): Promise<ManagerViewResult> {
  const windowStart = dayStart(toIso(from));
  const windowEnd = addDays(dayStart(toIso(to)), 1);
  const days = Math.round((windowEnd.getTime() - windowStart.getTime()) / 86_400_000);

  const profile = await prisma.hotelProfile.findFirst({ select: { roomCapacity: true } });
  const roomCount = profile?.roomCapacity ?? 0;
  const ooo = await prisma.room.count({
    where: { deleted: false, disabled: false, OR: [{ status: 'OOO' }, { inventoryStatus: 'OOO' }] },
  });
  const sellableRooms = roomCount - ooo;
  const capacity = sellableRooms * days;

  const [reservations, charges, cancellations] = await Promise.all([
    prisma.reservation.findMany({
      where: {
        status: { in: ['CONFIRMED', 'IN_HOUSE', 'CHECKED_OUT'] },
        checkInDate: { lt: windowEnd },
        checkOutDate: { gt: windowStart },
      },
      select: { checkInDate: true, checkOutDate: true },
    }),
    prisma.folioCharge.findMany({
      where: { businessDate: { gte: windowStart, lt: windowEnd } },
      select: { amount: true },
    }),
    prisma.reservation.count({
      where: {
        status: 'CANCELLED',
        updatedAt: { gte: windowStart, lt: windowEnd },
      },
    }),
  ]);

  const totalRevenue = charges.reduce((s, c) => s + Number(c.amount), 0);
  const totalRes = reservations.length;
  const arrivals = reservations.filter((r) => r.checkInDate >= windowStart && r.checkInDate < windowEnd).length;
  const departures = reservations.filter((r) => r.checkOutDate >= windowStart && r.checkOutDate < windowEnd).length;

  const totalLos = reservations.reduce((s, r) => {
    return s + Math.round((r.checkOutDate.getTime() - r.checkInDate.getTime()) / 86_400_000);
  }, 0);

  return {
    dateFrom: toIso(from),
    dateTo: toIso(to),
    totalRooms: roomCount,
    sellableRooms,
    totalReservations: totalRes,
    occupancyPct: safePct(totalRes, capacity),
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    adr: safeDiv(totalRevenue, totalRes),
    revPar: safeDiv(totalRevenue, capacity),
    arrivals,
    departures,
    cancellations,
    avgLos: safeDiv(totalLos, totalRes, 1),
  };
}
