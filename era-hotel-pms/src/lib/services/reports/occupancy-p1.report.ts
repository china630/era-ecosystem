import { prisma } from '@/lib/prisma';
import {
  countDoorsUsedOnNight,
  type ShareReservationSlice,
} from '@/lib/services/share-assignment.service';

// ── Shared helpers ──

async function getSellableRoomInfo() {
  const profile = await prisma.hotelProfile.findFirst({ select: { roomCapacity: true } });
  const rooms = await prisma.room.findMany({
    where: { deleted: false, disabled: false },
    select: { id: true, status: true, roomTypeId: true },
  });
  const totalRooms = profile?.roomCapacity ?? rooms.length;
  const ooo = rooms.filter((r) => r.status === 'OOO' || r.status === 'OOS').length;
  return { totalRooms, sellable: totalRooms - ooo, rooms };
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

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

type OccReservation = ShareReservationSlice & { roomTypeId: string };

async function loadOccReservations(windowStart: Date, windowEnd: Date): Promise<OccReservation[]> {
  return prisma.reservation.findMany({
    where: {
      status: { in: ['CONFIRMED', 'IN_HOUSE', 'CHECKED_OUT', 'OPTION'] },
      checkInDate: { lt: windowEnd },
      checkOutDate: { gt: windowStart },
    },
    select: {
      id: true,
      roomId: true,
      roomTypeId: true,
      shareEligible: true,
      shareGender: true,
      adults: true,
      checkInDate: true,
      checkOutDate: true,
      shareBedIndex: true,
    },
  });
}

function guestNightsOnNight(reservations: OccReservation[], night: Date, roomTypeId?: string): number {
  const nightEnd = addDays(night, 1);
  return reservations.filter(
    (r) =>
      (!roomTypeId || r.roomTypeId === roomTypeId) &&
      r.checkInDate < nightEnd &&
      r.checkOutDate > night,
  ).length;
}

function doorsOnNight(
  reservations: OccReservation[],
  night: Date,
  maxBedByType: Map<string, number>,
  roomTypeId?: string,
): number {
  if (roomTypeId) {
    const slices = reservations.filter((r) => r.roomTypeId === roomTypeId);
    return countDoorsUsedOnNight(slices, night, maxBedByType.get(roomTypeId) ?? 2);
  }
  let total = 0;
  const byType = new Map<string, OccReservation[]>();
  for (const r of reservations) {
    const list = byType.get(r.roomTypeId) ?? [];
    list.push(r);
    byType.set(r.roomTypeId, list);
  }
  for (const [rtId, list] of byType) {
    total += countDoorsUsedOnNight(list, night, maxBedByType.get(rtId) ?? 2);
  }
  return total;
}

// ── occupancy-graph ──

export interface OccupancyGraphRow {
  date: string;
  occupancyPct: number;
  /** Physical doors occupied (share-aware). */
  roomsSold: number;
  roomsAvailable: number;
  /** Overlapping stay count (guest/bed nights). */
  guestNights: number;
}

export interface OccupancyGraphResult {
  rows: OccupancyGraphRow[];
}

export async function queryOccupancyGraph(from: Date, to: Date): Promise<OccupancyGraphResult> {
  const { sellable } = await getSellableRoomInfo();
  const windowStart = dayStart(toIso(from));
  const windowEnd = addDays(dayStart(toIso(to)), 1);

  const [reservations, roomTypes] = await Promise.all([
    loadOccReservations(windowStart, windowEnd),
    prisma.roomType.findMany({ select: { id: true, adultCapacity: true } }),
  ]);
  const maxBedByType = new Map(roomTypes.map((rt) => [rt.id, rt.adultCapacity ?? 2]));

  const rows: OccupancyGraphRow[] = [];
  const cursor = new Date(windowStart);
  while (cursor < windowEnd) {
    const doors = doorsOnNight(reservations, cursor, maxBedByType);
    const guests = guestNightsOnNight(reservations, cursor);
    const pct = sellable > 0 ? Math.round((doors / sellable) * 1000) / 10 : 0;
    rows.push({
      date: toIso(cursor),
      occupancyPct: pct,
      roomsSold: doors,
      roomsAvailable: sellable,
      guestNights: guests,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return { rows };
}

// ── occupancy-graph-detail ──

export interface OccupancyGraphDetailRow {
  date: string;
  roomTypeCode: string;
  roomTypeName: string;
  /** Doors occupied (share-aware). */
  sold: number;
  quota: number;
  occupancyPct: number;
  guestNights: number;
}

export interface OccupancyGraphDetailResult {
  rows: OccupancyGraphDetailRow[];
}

export async function queryOccupancyGraphDetail(from: Date, to: Date): Promise<OccupancyGraphDetailResult> {
  const windowStart = dayStart(toIso(from));
  const windowEnd = addDays(dayStart(toIso(to)), 1);

  const [roomTypes, reservations] = await Promise.all([
    prisma.roomType.findMany({ where: { active: true }, orderBy: { code: 'asc' } }),
    loadOccReservations(windowStart, windowEnd),
  ]);
  const maxBedByType = new Map(roomTypes.map((rt) => [rt.id, rt.adultCapacity ?? 2]));

  const rows: OccupancyGraphDetailRow[] = [];
  const cursor = new Date(windowStart);
  while (cursor < windowEnd) {
    const dateStr = toIso(cursor);
    for (const rt of roomTypes) {
      const sold = doorsOnNight(reservations, cursor, maxBedByType, rt.id);
      const guests = guestNightsOnNight(reservations, cursor, rt.id);
      const pct = rt.baseQuota > 0 ? Math.round((sold / rt.baseQuota) * 1000) / 10 : 0;
      rows.push({
        date: dateStr,
        roomTypeCode: rt.code,
        roomTypeName: rt.name,
        sold,
        quota: rt.baseQuota,
        occupancyPct: pct,
        guestNights: guests,
      });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return { rows };
}

// ── forecast-wo-rev (forecast without revenue) ──

export interface ForecastWoRevRow {
  date: string;
  arrivals: number;
  departures: number;
  stayovers: number;
  sold: number;
  available: number;
  occupancyPct: number;
}

export interface ForecastWoRevResult {
  rows: ForecastWoRevRow[];
}

export async function queryForecastWoRev(from: Date, to: Date): Promise<ForecastWoRevResult> {
  const { sellable } = await getSellableRoomInfo();
  const windowStart = dayStart(toIso(from));
  const windowEnd = addDays(dayStart(toIso(to)), 1);

  const [reservations, roomTypes] = await Promise.all([
    loadOccReservations(windowStart, windowEnd),
    prisma.roomType.findMany({ select: { id: true, adultCapacity: true } }),
  ]);
  const maxBedByType = new Map(roomTypes.map((rt) => [rt.id, rt.adultCapacity ?? 2]));

  const rows: ForecastWoRevRow[] = [];
  const cursor = new Date(windowStart);
  while (cursor < windowEnd) {
    const dateStr = toIso(cursor);
    const arrivals = reservations.filter((r) => toIso(r.checkInDate) === dateStr).length;
    const departures = reservations.filter((r) => toIso(r.checkOutDate) === dateStr).length;
    const sold = doorsOnNight(reservations, cursor, maxBedByType);
    const stayovers = Math.max(0, guestNightsOnNight(reservations, cursor) - arrivals);
    const available = Math.max(sellable - sold, 0);
    const occupancyPct = sellable > 0 ? Math.round((sold / sellable) * 1000) / 10 : 0;
    rows.push({ date: dateStr, arrivals, departures, stayovers, sold, available, occupancyPct });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return { rows };
}

// ── forecast-board ──

export interface ForecastBoardRow {
  date: string;
  roomTypeCode: string;
  roomTypeName: string;
  sold: number;
  quota: number;
  available: number;
}

export interface ForecastBoardResult {
  rows: ForecastBoardRow[];
}

export async function queryForecastBoard(from: Date, to: Date): Promise<ForecastBoardResult> {
  const windowStart = dayStart(toIso(from));
  const windowEnd = addDays(dayStart(toIso(to)), 1);

  const [roomTypes, reservations] = await Promise.all([
    prisma.roomType.findMany({ where: { active: true }, orderBy: { code: 'asc' } }),
    loadOccReservations(windowStart, windowEnd),
  ]);
  const maxBedByType = new Map(roomTypes.map((rt) => [rt.id, rt.adultCapacity ?? 2]));

  const rows: ForecastBoardRow[] = [];
  const cursor = new Date(windowStart);
  while (cursor < windowEnd) {
    for (const rt of roomTypes) {
      const sold = doorsOnNight(reservations, cursor, maxBedByType, rt.id);
      rows.push({
        date: toIso(cursor),
        roomTypeCode: rt.code,
        roomTypeName: rt.name,
        sold,
        quota: rt.baseQuota,
        available: Math.max(rt.baseQuota - sold, 0),
      });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return { rows };
}

// ── forecast (full with revenue) ──

export interface ForecastRow {
  date: string;
  arrivals: number;
  departures: number;
  sold: number;
  available: number;
  occupancyPct: number;
  revenue: number;
  adr: number;
  revPar: number;
}

export interface ForecastResult {
  rows: ForecastRow[];
}

export async function queryForecast(from: Date, to: Date): Promise<ForecastResult> {
  const { sellable } = await getSellableRoomInfo();
  const windowStart = dayStart(toIso(from));
  const windowEnd = addDays(dayStart(toIso(to)), 1);

  const [reservations, charges, roomTypes] = await Promise.all([
    loadOccReservations(windowStart, windowEnd),
    prisma.folioCharge.findMany({
      where: { businessDate: { gte: windowStart, lt: windowEnd } },
      select: { businessDate: true, amount: true },
    }),
    prisma.roomType.findMany({ select: { id: true, adultCapacity: true } }),
  ]);
  const maxBedByType = new Map(roomTypes.map((rt) => [rt.id, rt.adultCapacity ?? 2]));

  const rows: ForecastRow[] = [];
  const cursor = new Date(windowStart);
  while (cursor < windowEnd) {
    const dateStr = toIso(cursor);
    const arrivals = reservations.filter((r) => toIso(r.checkInDate) === dateStr).length;
    const departures = reservations.filter((r) => toIso(r.checkOutDate) === dateStr).length;
    const sold = doorsOnNight(reservations, cursor, maxBedByType);
    const available = Math.max(sellable - sold, 0);
    const occupancyPct = sellable > 0 ? Math.round((sold / sellable) * 1000) / 10 : 0;
    const revenue = charges
      .filter((c) => toIso(c.businessDate) === dateStr)
      .reduce((s, c) => s + Number(c.amount), 0);
    const adr = sold > 0 ? Math.round((revenue / sold) * 100) / 100 : 0;
    const revPar = sellable > 0 ? Math.round((revenue / sellable) * 100) / 100 : 0;
    rows.push({ date: dateStr, arrivals, departures, sold, available, occupancyPct, revenue, adr, revPar });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return { rows };
}

// ── forecast-compare ──

export interface ForecastCompareRow {
  date: string;
  currentSold: number;
  currentOccPct: number;
  currentRevenue: number;
  priorSold: number;
  priorOccPct: number;
  priorRevenue: number;
}

export interface ForecastCompareResult {
  rows: ForecastCompareRow[];
}

export async function queryForecastCompare(from: Date, to: Date): Promise<ForecastCompareResult> {
  const { sellable } = await getSellableRoomInfo();
  const windowStart = dayStart(toIso(from));
  const windowEnd = addDays(dayStart(toIso(to)), 1);
  const days = daysBetween(windowStart, windowEnd);
  const priorStart = new Date(windowStart);
  priorStart.setUTCFullYear(priorStart.getUTCFullYear() - 1);
  const priorEnd = addDays(priorStart, days);

  const [curRes, curCharges, priorRes, priorCharges] = await Promise.all([
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
      select: { businessDate: true, amount: true },
    }),
    prisma.reservation.findMany({
      where: {
        status: { in: ['CONFIRMED', 'IN_HOUSE', 'CHECKED_OUT'] },
        checkInDate: { lt: priorEnd },
        checkOutDate: { gt: priorStart },
      },
      select: { checkInDate: true, checkOutDate: true },
    }),
    prisma.folioCharge.findMany({
      where: { businessDate: { gte: priorStart, lt: priorEnd } },
      select: { businessDate: true, amount: true },
    }),
  ]);

  const rows: ForecastCompareRow[] = [];
  for (let i = 0; i < days; i++) {
    const cur = addDays(windowStart, i);
    const curNext = addDays(cur, 1);
    const pri = addDays(priorStart, i);
    const priNext = addDays(pri, 1);
    const curDateStr = toIso(cur);
    const priDateStr = toIso(pri);

    const currentSold = curRes.filter((r) => r.checkInDate < curNext && r.checkOutDate > cur).length;
    const priorSold = priorRes.filter((r) => r.checkInDate < priNext && r.checkOutDate > pri).length;
    const currentRevenue = curCharges.filter((c) => toIso(c.businessDate) === curDateStr).reduce((s, c) => s + Number(c.amount), 0);
    const priorRevenue = priorCharges.filter((c) => toIso(c.businessDate) === priDateStr).reduce((s, c) => s + Number(c.amount), 0);

    rows.push({
      date: curDateStr,
      currentSold,
      currentOccPct: sellable > 0 ? Math.round((currentSold / sellable) * 1000) / 10 : 0,
      currentRevenue,
      priorSold,
      priorOccPct: sellable > 0 ? Math.round((priorSold / sellable) * 1000) / 10 : 0,
      priorRevenue,
    });
  }
  return { rows };
}

// ── board-forecast (alias — same underlying query as forecast-board) ──

export const queryBoardForecast = queryForecastBoard;

// ── room-type-yoy ──

export interface RoomTypeYoyRow {
  roomTypeCode: string;
  roomTypeName: string;
  currentNights: number;
  currentOccPct: number;
  priorNights: number;
  priorOccPct: number;
  changeNights: number;
}

export interface RoomTypeYoyResult {
  rows: RoomTypeYoyRow[];
}

export async function queryRoomTypeYoy(from: Date, to: Date): Promise<RoomTypeYoyResult> {
  const windowStart = dayStart(toIso(from));
  const windowEnd = addDays(dayStart(toIso(to)), 1);
  const days = daysBetween(windowStart, windowEnd);
  const priorStart = new Date(windowStart);
  priorStart.setUTCFullYear(priorStart.getUTCFullYear() - 1);
  const priorEnd = addDays(priorStart, days);

  const [roomTypes, curRes, priorRes] = await Promise.all([
    prisma.roomType.findMany({ where: { active: true }, orderBy: { code: 'asc' } }),
    prisma.reservation.findMany({
      where: {
        status: { in: ['CONFIRMED', 'IN_HOUSE', 'CHECKED_OUT'] },
        checkInDate: { lt: windowEnd },
        checkOutDate: { gt: windowStart },
      },
      select: { roomTypeId: true, checkInDate: true, checkOutDate: true },
    }),
    prisma.reservation.findMany({
      where: {
        status: { in: ['CONFIRMED', 'IN_HOUSE', 'CHECKED_OUT'] },
        checkInDate: { lt: priorEnd },
        checkOutDate: { gt: priorStart },
      },
      select: { roomTypeId: true, checkInDate: true, checkOutDate: true },
    }),
  ]);

  function countNights(res: typeof curRes, rtId: string, start: Date, end: Date): number {
    const filtered = res.filter((r) => r.roomTypeId === rtId);
    let total = 0;
    const c = new Date(start);
    while (c < end) {
      const n = addDays(c, 1);
      total += filtered.filter((r) => r.checkInDate < n && r.checkOutDate > c).length;
      c.setUTCDate(c.getUTCDate() + 1);
    }
    return total;
  }

  const rows: RoomTypeYoyRow[] = roomTypes.map((rt) => {
    const capacity = rt.baseQuota * days;
    const currentNights = countNights(curRes, rt.id, windowStart, windowEnd);
    const priorNights = countNights(priorRes, rt.id, priorStart, priorEnd);
    return {
      roomTypeCode: rt.code,
      roomTypeName: rt.name,
      currentNights,
      currentOccPct: capacity > 0 ? Math.round((currentNights / capacity) * 1000) / 10 : 0,
      priorNights,
      priorOccPct: capacity > 0 ? Math.round((priorNights / capacity) * 1000) / 10 : 0,
      changeNights: currentNights - priorNights,
    };
  });
  return { rows };
}
