import { prisma } from '@/lib/prisma';

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dayStart(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

// ── reservation-sales ──

export interface ReservationSalesRow {
  date: string;
  newReservations: number;
  roomNights: number;
  revenue: number;
}

export interface ReservationSalesResult {
  rows: ReservationSalesRow[];
  totalReservations: number;
  totalRevenue: number;
}

export async function queryReservationSales(from: Date, to: Date): Promise<ReservationSalesResult> {
  const start = dayStart(toIso(from));
  const end = addDays(dayStart(toIso(to)), 1);

  const reservations = await prisma.reservation.findMany({
    where: {
      status: { in: ['CONFIRMED', 'IN_HOUSE', 'CHECKED_OUT'] },
      checkInDate: { gte: start, lt: end },
    },
    select: {
      checkInDate: true,
      checkOutDate: true,
      totalAmount: true,
    },
  });

  const map = new Map<string, { count: number; nights: number; revenue: number }>();
  for (const r of reservations) {
    const dateStr = toIso(r.checkInDate);
    const e = map.get(dateStr) ?? { count: 0, nights: 0, revenue: 0 };
    const nights = Math.round((r.checkOutDate.getTime() - r.checkInDate.getTime()) / 86_400_000);
    e.count++;
    e.nights += nights;
    e.revenue += Number(r.totalAmount);
    map.set(dateStr, e);
  }

  const rows: ReservationSalesRow[] = [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      newReservations: v.count,
      roomNights: v.nights,
      revenue: Math.round(v.revenue * 100) / 100,
    }));

  return {
    rows,
    totalReservations: rows.reduce((s, r) => s + r.newReservations, 0),
    totalRevenue: rows.reduce((s, r) => s + r.revenue, 0),
  };
}

// ── reservations-by-create ──

export interface ReservationsByCreateRow {
  createdDate: string;
  reservationCount: number;
  totalAmount: number;
  sourceCode: string;
  sourceName: string;
}

export interface ReservationsByCreateResult {
  rows: ReservationsByCreateRow[];
}

export async function queryReservationsByCreate(from: Date, to: Date): Promise<ReservationsByCreateResult> {
  const start = dayStart(toIso(from));
  const end = addDays(dayStart(toIso(to)), 1);

  const reservations = await prisma.reservation.findMany({
    where: {
      createdAt: { gte: start, lt: end },
      status: { not: 'CANCELLED' },
    },
    select: {
      createdAt: true,
      totalAmount: true,
      source: { select: { code: true, name: true } },
    },
  });

  const map = new Map<string, ReservationsByCreateRow>();
  for (const r of reservations) {
    const dateStr = toIso(r.createdAt);
    const srcCode = r.source?.code ?? 'DIRECT';
    const k = `${dateStr}|${srcCode}`;
    const e = map.get(k) ?? { createdDate: dateStr, reservationCount: 0, totalAmount: 0, sourceCode: srcCode, sourceName: r.source?.name ?? 'Direct' };
    e.reservationCount++;
    e.totalAmount += Number(r.totalAmount);
    map.set(k, e);
  }

  const rows = [...map.values()].sort((a, b) => a.createdDate.localeCompare(b.createdDate));
  rows.forEach((r) => { r.totalAmount = Math.round(r.totalAmount * 100) / 100; });
  return { rows };
}

// ── cancel-by-cancel ──

export interface CancelByCancelRow {
  cancelDate: string;
  guestName: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  amount: number;
}

export interface CancelByCancelResult {
  rows: CancelByCancelRow[];
  totalCancelled: number;
  totalLostRevenue: number;
}

export async function queryCancelByCancel(from: Date, to: Date): Promise<CancelByCancelResult> {
  const start = dayStart(toIso(from));
  const end = addDays(dayStart(toIso(to)), 1);

  const reservations = await prisma.reservation.findMany({
    where: {
      status: 'CANCELLED',
      updatedAt: { gte: start, lt: end },
    },
    select: {
      updatedAt: true,
      totalAmount: true,
      checkInDate: true,
      checkOutDate: true,
      guest: { select: { fullName: true } },
      roomType: { select: { name: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const rows: CancelByCancelRow[] = reservations.map((r) => ({
    cancelDate: toIso(r.updatedAt),
    guestName: r.guest.fullName,
    roomType: r.roomType.name,
    checkIn: toIso(r.checkInDate),
    checkOut: toIso(r.checkOutDate),
    amount: Number(r.totalAmount),
  }));

  return {
    rows,
    totalCancelled: rows.length,
    totalLostRevenue: Math.round(rows.reduce((s, r) => s + r.amount, 0) * 100) / 100,
  };
}

// ── cancel-by-create ──

export interface CancelByCreateRow {
  createdDate: string;
  guestName: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  amount: number;
}

export interface CancelByCreateResult {
  rows: CancelByCreateRow[];
  totalCancelled: number;
  totalLostRevenue: number;
}

export async function queryCancelByCreate(from: Date, to: Date): Promise<CancelByCreateResult> {
  const start = dayStart(toIso(from));
  const end = addDays(dayStart(toIso(to)), 1);

  const reservations = await prisma.reservation.findMany({
    where: {
      status: 'CANCELLED',
      createdAt: { gte: start, lt: end },
    },
    select: {
      createdAt: true,
      totalAmount: true,
      checkInDate: true,
      checkOutDate: true,
      guest: { select: { fullName: true } },
      roomType: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const rows: CancelByCreateRow[] = reservations.map((r) => ({
    createdDate: toIso(r.createdAt),
    guestName: r.guest.fullName,
    roomType: r.roomType.name,
    checkIn: toIso(r.checkInDate),
    checkOut: toIso(r.checkOutDate),
    amount: Number(r.totalAmount),
  }));

  return {
    rows,
    totalCancelled: rows.length,
    totalLostRevenue: Math.round(rows.reduce((s, r) => s + r.amount, 0) * 100) / 100,
  };
}

// ── definite-reservation ──

export interface DefiniteReservationRow {
  guestName: string;
  roomType: string;
  roomNumber: string | null;
  checkIn: string;
  checkOut: string;
  nights: number;
  rate: number;
  agency: string | null;
  source: string | null;
}

export interface DefiniteReservationResult {
  rows: DefiniteReservationRow[];
  totalReservations: number;
  totalNights: number;
}

export async function queryDefiniteReservation(from: Date, to: Date): Promise<DefiniteReservationResult> {
  const start = dayStart(toIso(from));
  const end = addDays(dayStart(toIso(to)), 1);

  const reservations = await prisma.reservation.findMany({
    where: {
      status: 'CONFIRMED',
      checkInDate: { lt: end },
      checkOutDate: { gt: start },
    },
    select: {
      guest: { select: { fullName: true } },
      roomType: { select: { name: true } },
      room: { select: { roomNumber: true } },
      agency: { select: { name: true } },
      source: { select: { name: true } },
      checkInDate: true,
      checkOutDate: true,
      totalAmount: true,
    },
    orderBy: { checkInDate: 'asc' },
  });

  const rows: DefiniteReservationRow[] = reservations.map((r) => {
    const nights = Math.round((r.checkOutDate.getTime() - r.checkInDate.getTime()) / 86_400_000);
    return {
      guestName: r.guest.fullName,
      roomType: r.roomType.name,
      roomNumber: r.room?.roomNumber ?? null,
      checkIn: toIso(r.checkInDate),
      checkOut: toIso(r.checkOutDate),
      nights,
      rate: nights > 0 ? Math.round((Number(r.totalAmount) / nights) * 100) / 100 : 0,
      agency: r.agency?.name ?? null,
      source: r.source?.name ?? null,
    };
  });

  return {
    rows,
    totalReservations: rows.length,
    totalNights: rows.reduce((s, r) => s + r.nights, 0),
  };
}

// ── crm-report ──

export interface CrmReportRow {
  guestName: string;
  nationality: string;
  visitCount: number;
  totalSpend: number;
  vipType: string | null;
  loyaltyTier: string | null;
  lastStay: string | null;
}

export interface CrmReportResult {
  rows: CrmReportRow[];
}

export async function queryCrmReport(from: Date, to: Date): Promise<CrmReportResult> {
  const start = dayStart(toIso(from));
  const end = addDays(dayStart(toIso(to)), 1);

  const reservations = await prisma.reservation.findMany({
    where: {
      status: { in: ['IN_HOUSE', 'CHECKED_OUT'] },
      checkInDate: { lt: end },
      checkOutDate: { gt: start },
    },
    select: {
      guest: {
        select: {
          fullName: true,
          nationality: true,
          visitCount: true,
          vipType: true,
          loyaltyTier: true,
        },
      },
      totalAmount: true,
      checkOutDate: true,
    },
  });

  const guestMap = new Map<string, CrmReportRow>();
  for (const r of reservations) {
    const name = r.guest.fullName;
    const e = guestMap.get(name) ?? {
      guestName: name,
      nationality: r.guest.nationality ?? 'N/A',
      visitCount: r.guest.visitCount,
      totalSpend: 0,
      vipType: r.guest.vipType,
      loyaltyTier: r.guest.loyaltyTier,
      lastStay: null,
    };
    e.totalSpend += Number(r.totalAmount);
    const co = toIso(r.checkOutDate);
    if (!e.lastStay || co > e.lastStay) e.lastStay = co;
    guestMap.set(name, e);
  }

  const rows = [...guestMap.values()].sort((a, b) => b.totalSpend - a.totalSpend);
  rows.forEach((r) => { r.totalSpend = Math.round(r.totalSpend * 100) / 100; });
  return { rows };
}

// ── guest-demographics (SCREEN only) ──

export interface GuestDemographicsRow {
  nationality: string;
  guestCount: number;
  pctOfTotal: number;
}

export interface GuestDemographicsResult {
  rows: GuestDemographicsRow[];
  totalGuests: number;
}

export async function queryGuestDemographics(from: Date, to: Date): Promise<GuestDemographicsResult> {
  const start = dayStart(toIso(from));
  const end = addDays(dayStart(toIso(to)), 1);

  const reservations = await prisma.reservation.findMany({
    where: {
      status: { in: ['CONFIRMED', 'IN_HOUSE', 'CHECKED_OUT'] },
      checkInDate: { lt: end },
      checkOutDate: { gt: start },
    },
    select: {
      guest: { select: { nationality: true } },
    },
  });

  const map = new Map<string, number>();
  for (const r of reservations) {
    const nat = r.guest.nationality ?? 'N/A';
    map.set(nat, (map.get(nat) ?? 0) + 1);
  }

  const totalGuests = reservations.length;
  const rows: GuestDemographicsRow[] = [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([nationality, guestCount]) => ({
      nationality,
      guestCount,
      pctOfTotal: totalGuests > 0 ? Math.round((guestCount / totalGuests) * 1000) / 10 : 0,
    }));

  return { rows, totalGuests };
}
