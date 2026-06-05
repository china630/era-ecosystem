import type { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/lib/prisma';
import { decimalToNumber } from '@/lib/decimal';
import { folioBalance } from '@/lib/services/folio.service';
import type { ClinicCapacitySummary } from '@/lib/integration/clinic-capacity-client';
import {
  addDays,
  computeHotelStatus,
  endOfDay,
  occupancyDeviationPct,
  revenueFlashBucket,
  startOfDay,
  startOfMonth,
  startOfYear,
  type HotelStatusLevel,
  type MetricTriple,
} from '@/lib/services/executive-cockpit.helpers';

export type ExecutiveDashboardKpis = {
  date: string;
  occupancyPct: number;
  guestsInHouse: number;
  arrivalsToday: number;
  departuresToday: number;
  revenueToday: number;
  outstandingBalance: number;
  adr: number;
  revpar: number;
  roomsTotal: number;
  roomsSoldTonight: number;
};

export type ExecutiveCockpit = ExecutiveDashboardKpis & {
  hotelStatus: HotelStatusLevel;
  occupancy: {
    factPct: number;
    planPct: number;
    deviationPct: number;
    roomsFact: number;
    roomsPlan: number;
  };
  adrCompare: MetricTriple;
  revparCompare: MetricTriple;
  revenue: {
    today: number;
    mtd: number;
    ytd: number;
    roomToday: number;
    fbToday: number;
    spaToday: number;
    medicalToday: number;
    otherToday: number;
  };
  receivables: {
    total: number;
    overdue: number;
  };
  clinicCapacity: ClinicCapacitySummary | null;
};

export function computeAdr(roomRevenue: number, roomsSold: number): number {
  if (roomsSold <= 0) return 0;
  return roomRevenue / roomsSold;
}

export function computeRevpar(roomRevenue: number, roomsTotal: number): number {
  if (roomsTotal <= 0) return 0;
  return roomRevenue / roomsTotal;
}

async function fetchClinicCapacitySummary(
  refDate: Date,
): Promise<ClinicCapacitySummary | null> {
  const { fetchClinicCapacitySummary: fetchCap } = await import(
    '@/lib/integration/clinic-capacity-client'
  );
  return fetchCap(refDate);
}

type ChargeRow = {
  amount: Decimal;
  qty: number;
  businessDate: Date;
  revenueCode: { code: string; department: { code: string } | null };
};

function chargeLineTotal(c: Pick<ChargeRow, 'amount' | 'qty'>): number {
  return decimalToNumber(c.amount) * c.qty;
}

function sumCharges(rows: ChargeRow[]): number {
  return rows.reduce((s, c) => s + chargeLineTotal(c), 0);
}

function sumAmountQty(rows: Array<{ amount: Decimal; qty: number }>): number {
  return rows.reduce((s, c) => s + chargeLineTotal(c), 0);
}

function bucketCharges(rows: ChargeRow[]) {
  let room = 0;
  let fb = 0;
  let spa = 0;
  let medical = 0;
  let other = 0;
  for (const c of rows) {
    const amt = chargeLineTotal(c);
    const bucket = revenueFlashBucket(c.revenueCode.code, c.revenueCode.department?.code);
    if (bucket === 'room') room += amt;
    else if (bucket === 'fb') fb += amt;
    else if (bucket === 'spa') spa += amt;
    else if (bucket === 'medical') medical += amt;
    else other += amt;
  }
  return { room, fb, spa, medical, other, total: room + fb + spa + medical + other };
}

async function countRoomsSoldNight(day: Date): Promise<number> {
  const nightEnd = addDays(day, 1);
  return prisma.reservation.count({
    where: {
      status: { in: ['CONFIRMED', 'IN_HOUSE', 'OPTION'] },
      checkInDate: { lt: nightEnd },
      checkOutDate: { gt: day },
    },
  });
}

async function countRoomsInHouseNight(day: Date): Promise<number> {
  const nightEnd = addDays(day, 1);
  return prisma.reservation.count({
    where: {
      status: 'IN_HOUSE',
      checkInDate: { lt: nightEnd },
      checkOutDate: { gt: day },
    },
  });
}

async function getRoomsTotal(): Promise<number> {
  return prisma.room.count({ where: { status: { notIn: ['OOO', 'OOS'] } } });
}

async function getDayFlashMetrics(day: Date) {
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);
  const roomsTotal = await getRoomsTotal();
  const roomsPlan = await countRoomsSoldNight(dayStart);
  const roomsFact = await countRoomsInHouseNight(dayStart);
  const planPct = roomsTotal > 0 ? Math.round((roomsPlan / roomsTotal) * 1000) / 10 : 0;
  const factPct = roomsTotal > 0 ? Math.round((roomsFact / roomsTotal) * 1000) / 10 : 0;

  const charges = await prisma.folioCharge.findMany({
    where: { businessDate: { gte: dayStart, lte: dayEnd } },
    include: { revenueCode: { include: { department: true } } },
  });

  const buckets = bucketCharges(charges);
  const adr = computeAdr(buckets.room, roomsPlan);
  const revpar = computeRevpar(buckets.room, roomsTotal);

  return {
    roomsTotal,
    roomsPlan,
    roomsFact,
    planPct,
    factPct,
    buckets,
    adr: Math.round(adr * 100) / 100,
    revpar: Math.round(revpar * 100) / 100,
  };
}

async function sumRevenueBetween(from: Date, to: Date): Promise<number> {
  const charges = await prisma.folioCharge.findMany({
    where: { businessDate: { gte: from, lte: to } },
    select: { amount: true, qty: true },
  });
  return Math.round(sumAmountQty(charges) * 100) / 100;
}

async function getReceivables(asOf: Date) {
  const overdueCutoff = addDays(startOfDay(asOf), -7);
  const reservations = await prisma.reservation.findMany({
    where: { status: { in: ['IN_HOUSE', 'CONFIRMED', 'CHECKED_OUT'] } },
    include: {
      folios: { include: { charges: true, payments: true } },
    },
    take: 800,
  });

  let total = 0;
  let overdue = 0;
  for (const r of reservations) {
    for (const f of r.folios) {
      const bal = folioBalance(f.charges, f.payments);
      if (bal <= 0) continue;
      total += bal;
      const co = startOfDay(r.checkOutDate);
      if (co < overdueCutoff || (r.status === 'CHECKED_OUT' && co < startOfDay(asOf))) {
        overdue += bal;
      }
    }
  }
  return {
    total: Math.round(total * 100) / 100,
    overdue: Math.round(overdue * 100) / 100,
  };
}

export async function getExecutiveDashboard(dateInput?: Date): Promise<ExecutiveCockpit> {
  const day = startOfDay(dateInput ?? new Date());
  const dayEnd = endOfDay(day);

  const today = await getDayFlashMetrics(day);
  const yesterday = await getDayFlashMetrics(addDays(day, -1));
  const lastWeek = await getDayFlashMetrics(addDays(day, -7));

  const mtdFrom = startOfMonth(day);
  const ytdFrom = startOfYear(day);
  const revenueMtd = await sumRevenueBetween(mtdFrom, dayEnd);
  const revenueYtd = await sumRevenueBetween(ytdFrom, dayEnd);

  const receivables = await getReceivables(day);

  const deviation = occupancyDeviationPct(today.factPct, today.planPct);
  const hotelStatus = computeHotelStatus({
    occupancyFactPct: today.factPct,
    occupancyDeviationPct: deviation,
    overdueBalance: receivables.overdue,
    totalReceivable: receivables.total,
  });

  const guestsInHouse = await prisma.reservation.count({ where: { status: 'IN_HOUSE' } });

  const arrivalsToday = await prisma.reservation.count({
    where: {
      checkInDate: { gte: day, lte: dayEnd },
      status: { in: ['CONFIRMED', 'IN_HOUSE', 'OPTION'] },
    },
  });

  const departuresToday = await prisma.reservation.count({
    where: {
      checkOutDate: { gte: day, lte: dayEnd },
      status: { in: ['IN_HOUSE', 'CONFIRMED'] },
    },
  });

  const adrCompare: MetricTriple = {
    today: today.adr,
    yesterday: yesterday.adr,
    lastWeek: lastWeek.adr,
  };

  const revparCompare: MetricTriple = {
    today: today.revpar,
    yesterday: yesterday.revpar,
    lastWeek: lastWeek.revpar,
  };

  const clinicCapacity = await fetchClinicCapacitySummary(day);

  return {
    date: day.toISOString().slice(0, 10),
    hotelStatus,
    clinicCapacity,
    occupancy: {
      factPct: today.factPct,
      planPct: today.planPct,
      deviationPct: deviation,
      roomsFact: today.roomsFact,
      roomsPlan: today.roomsPlan,
    },
    adrCompare,
    revparCompare,
    revenue: {
      today: today.buckets.total,
      mtd: revenueMtd,
      ytd: revenueYtd,
      roomToday: Math.round(today.buckets.room * 100) / 100,
      fbToday: Math.round(today.buckets.fb * 100) / 100,
      spaToday: Math.round(today.buckets.spa * 100) / 100,
      medicalToday: Math.round(today.buckets.medical * 100) / 100,
      otherToday: Math.round(today.buckets.other * 100) / 100,
    },
    receivables,
    occupancyPct: today.planPct,
    guestsInHouse,
    arrivalsToday,
    departuresToday,
    revenueToday: today.buckets.total,
    outstandingBalance: receivables.total,
    adr: today.adr,
    revpar: today.revpar,
    roomsTotal: today.roomsTotal,
    roomsSoldTonight: today.roomsPlan,
  };
}
