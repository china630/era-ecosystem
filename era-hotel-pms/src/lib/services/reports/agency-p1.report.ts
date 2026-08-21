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

type ResWithAgency = {
  id: string;
  agencyId: string | null;
  agency: { code: string; name: string; commissionPercent: unknown } | null;
  roomTypeId: string;
  roomType: { code: string; name: string };
  guest: { nationality: string };
  segment: string | null;
  market: string | null;
  totalAmount: unknown;
  checkInDate: Date;
  checkOutDate: Date;
};

const AGENCY_RES_SELECT = {
  id: true,
  agencyId: true,
  agency: { select: { code: true, name: true, commissionPercent: true } },
  roomTypeId: true,
  roomType: { select: { code: true, name: true } },
  guest: { select: { nationality: true } },
  segment: true,
  market: true,
  totalAmount: true,
  checkInDate: true,
  checkOutDate: true,
} as const;

async function fetchReservations(start: Date, end: Date): Promise<ResWithAgency[]> {
  return prisma.reservation.findMany({
    where: {
      status: { in: ['CONFIRMED', 'IN_HOUSE', 'CHECKED_OUT'] },
      checkInDate: { lt: end },
      checkOutDate: { gt: start },
    },
    select: AGENCY_RES_SELECT,
  }) as unknown as ResWithAgency[];
}

// ── agency-analysis ──

export interface AgencyAnalysisRow {
  agencyCode: string;
  agencyName: string;
  roomNights: number;
  revenue: number;
  avgRate: number;
  commissionPct: number;
  commissionAmount: number;
}

export interface AgencyAnalysisResult {
  rows: AgencyAnalysisRow[];
  totalRevenue: number;
  totalCommission: number;
}

export async function queryAgencyAnalysis(from: Date, to: Date): Promise<AgencyAnalysisResult> {
  const start = dayStart(toIso(from));
  const end = addDays(dayStart(toIso(to)), 1);
  const reservations = await fetchReservations(start, end);

  const map = new Map<string, { code: string; name: string; nights: number; revenue: number; commPct: number }>();
  for (const r of reservations) {
    if (!r.agency) continue;
    const code = r.agency.code;
    const e = map.get(code) ?? { code, name: r.agency.name, nights: 0, revenue: 0, commPct: Number(r.agency.commissionPercent ?? 0) };
    e.nights++;
    e.revenue += Number(r.totalAmount);
    map.set(code, e);
  }

  const rows: AgencyAnalysisRow[] = [...map.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .map((v) => ({
      agencyCode: v.code,
      agencyName: v.name,
      roomNights: v.nights,
      revenue: Math.round(v.revenue * 100) / 100,
      avgRate: v.nights > 0 ? Math.round((v.revenue / v.nights) * 100) / 100 : 0,
      commissionPct: v.commPct,
      commissionAmount: Math.round(v.revenue * v.commPct / 100 * 100) / 100,
    }));

  return {
    rows,
    totalRevenue: rows.reduce((s, r) => s + r.revenue, 0),
    totalCommission: rows.reduce((s, r) => s + r.commissionAmount, 0),
  };
}

// ── agency-monthly ──

export interface AgencyMonthlyRow {
  agencyCode: string;
  agencyName: string;
  month: string;
  roomNights: number;
  revenue: number;
}

export interface AgencyMonthlyResult {
  rows: AgencyMonthlyRow[];
}

export async function queryAgencyMonthly(from: Date, to: Date): Promise<AgencyMonthlyResult> {
  const start = dayStart(toIso(from));
  const end = addDays(dayStart(toIso(to)), 1);
  const reservations = await fetchReservations(start, end);

  const map = new Map<string, AgencyMonthlyRow>();
  for (const r of reservations) {
    if (!r.agency) continue;
    const month = toIso(r.checkInDate).slice(0, 7);
    const k = `${r.agency.code}|${month}`;
    const e = map.get(k) ?? { agencyCode: r.agency.code, agencyName: r.agency.name, month, roomNights: 0, revenue: 0 };
    e.roomNights++;
    e.revenue += Number(r.totalAmount);
    map.set(k, e);
  }

  const rows = [...map.values()].sort((a, b) => a.agencyCode.localeCompare(b.agencyCode) || a.month.localeCompare(b.month));
  rows.forEach((r) => { r.revenue = Math.round(r.revenue * 100) / 100; });
  return { rows };
}

// ── agency-room-type-occ ──

export interface AgencyRoomTypeOccRow {
  agencyCode: string;
  agencyName: string;
  roomTypeCode: string;
  roomTypeName: string;
  roomNights: number;
}

export interface AgencyRoomTypeOccResult {
  rows: AgencyRoomTypeOccRow[];
}

export async function queryAgencyRoomTypeOcc(from: Date, to: Date): Promise<AgencyRoomTypeOccResult> {
  const start = dayStart(toIso(from));
  const end = addDays(dayStart(toIso(to)), 1);
  const reservations = await fetchReservations(start, end);

  const map = new Map<string, AgencyRoomTypeOccRow>();
  for (const r of reservations) {
    if (!r.agency) continue;
    const k = `${r.agency.code}|${r.roomType.code}`;
    const e = map.get(k) ?? { agencyCode: r.agency.code, agencyName: r.agency.name, roomTypeCode: r.roomType.code, roomTypeName: r.roomType.name, roomNights: 0 };
    e.roomNights++;
    map.set(k, e);
  }

  return { rows: [...map.values()].sort((a, b) => a.agencyCode.localeCompare(b.agencyCode)) };
}

// ── agency-monthly-occ ──

export interface AgencyMonthlyOccRow {
  agencyCode: string;
  agencyName: string;
  month: string;
  roomNights: number;
  occupancyPct: number;
}

export interface AgencyMonthlyOccResult {
  rows: AgencyMonthlyOccRow[];
}

export async function queryAgencyMonthlyOcc(from: Date, to: Date): Promise<AgencyMonthlyOccResult> {
  const start = dayStart(toIso(from));
  const end = addDays(dayStart(toIso(to)), 1);
  const reservations = await fetchReservations(start, end);

  const profile = await prisma.hotelProfile.findFirst({ select: { roomCapacity: true } });
  const totalRooms = profile?.roomCapacity ?? 78;

  const map = new Map<string, { code: string; name: string; month: string; nights: number }>();
  for (const r of reservations) {
    if (!r.agency) continue;
    const month = toIso(r.checkInDate).slice(0, 7);
    const k = `${r.agency.code}|${month}`;
    const e = map.get(k) ?? { code: r.agency.code, name: r.agency.name, month, nights: 0 };
    e.nights++;
    map.set(k, e);
  }

  const rows: AgencyMonthlyOccRow[] = [...map.values()]
    .sort((a, b) => a.code.localeCompare(b.code) || a.month.localeCompare(b.month))
    .map((v) => {
      const daysInMonth = 30;
      const capacity = totalRooms * daysInMonth;
      return {
        agencyCode: v.code,
        agencyName: v.name,
        month: v.month,
        roomNights: v.nights,
        occupancyPct: capacity > 0 ? Math.round((v.nights / capacity) * 1000) / 10 : 0,
      };
    });

  return { rows };
}

// ── agency-room-type-rev ──

export interface AgencyRoomTypeRevRow {
  agencyCode: string;
  agencyName: string;
  roomTypeCode: string;
  roomTypeName: string;
  revenue: number;
}

export interface AgencyRoomTypeRevResult {
  rows: AgencyRoomTypeRevRow[];
}

export async function queryAgencyRoomTypeRev(from: Date, to: Date): Promise<AgencyRoomTypeRevResult> {
  const start = dayStart(toIso(from));
  const end = addDays(dayStart(toIso(to)), 1);
  const reservations = await fetchReservations(start, end);

  const map = new Map<string, AgencyRoomTypeRevRow>();
  for (const r of reservations) {
    if (!r.agency) continue;
    const k = `${r.agency.code}|${r.roomType.code}`;
    const e = map.get(k) ?? { agencyCode: r.agency.code, agencyName: r.agency.name, roomTypeCode: r.roomType.code, roomTypeName: r.roomType.name, revenue: 0 };
    e.revenue += Number(r.totalAmount);
    map.set(k, e);
  }

  const rows = [...map.values()].sort((a, b) => a.agencyCode.localeCompare(b.agencyCode));
  rows.forEach((r) => { r.revenue = Math.round(r.revenue * 100) / 100; });
  return { rows };
}

// ── agency-nationality-rev ──

export interface AgencyNationalityRevRow {
  agencyCode: string;
  agencyName: string;
  nationality: string;
  revenue: number;
  roomNights: number;
}

export interface AgencyNationalityRevResult {
  rows: AgencyNationalityRevRow[];
}

export async function queryAgencyNationalityRev(from: Date, to: Date): Promise<AgencyNationalityRevResult> {
  const start = dayStart(toIso(from));
  const end = addDays(dayStart(toIso(to)), 1);
  const reservations = await fetchReservations(start, end);

  const map = new Map<string, AgencyNationalityRevRow>();
  for (const r of reservations) {
    if (!r.agency) continue;
    const nat = r.guest.nationality ?? 'N/A';
    const k = `${r.agency.code}|${nat}`;
    const e = map.get(k) ?? { agencyCode: r.agency.code, agencyName: r.agency.name, nationality: nat, revenue: 0, roomNights: 0 };
    e.revenue += Number(r.totalAmount);
    e.roomNights++;
    map.set(k, e);
  }

  const rows = [...map.values()].sort((a, b) => a.agencyCode.localeCompare(b.agencyCode));
  rows.forEach((r) => { r.revenue = Math.round(r.revenue * 100) / 100; });
  return { rows };
}

// ── agency-nationality-occ ──

export interface AgencyNationalityOccRow {
  agencyCode: string;
  agencyName: string;
  nationality: string;
  roomNights: number;
}

export interface AgencyNationalityOccResult {
  rows: AgencyNationalityOccRow[];
}

export async function queryAgencyNationalityOcc(from: Date, to: Date): Promise<AgencyNationalityOccResult> {
  const start = dayStart(toIso(from));
  const end = addDays(dayStart(toIso(to)), 1);
  const reservations = await fetchReservations(start, end);

  const map = new Map<string, AgencyNationalityOccRow>();
  for (const r of reservations) {
    if (!r.agency) continue;
    const nat = r.guest.nationality ?? 'N/A';
    const k = `${r.agency.code}|${nat}`;
    const e = map.get(k) ?? { agencyCode: r.agency.code, agencyName: r.agency.name, nationality: nat, roomNights: 0 };
    e.roomNights++;
    map.set(k, e);
  }

  return { rows: [...map.values()].sort((a, b) => a.agencyCode.localeCompare(b.agencyCode)) };
}

// ── agency-forecast-month ──

export interface AgencyForecastMonthRow {
  agencyCode: string;
  agencyName: string;
  date: string;
  expectedArrivals: number;
  expectedDepartures: number;
  roomNights: number;
}

export interface AgencyForecastMonthResult {
  rows: AgencyForecastMonthRow[];
}

export async function queryAgencyForecastMonth(from: Date, to: Date): Promise<AgencyForecastMonthResult> {
  const start = dayStart(toIso(from));
  const end = addDays(dayStart(toIso(to)), 1);

  const reservations = await prisma.reservation.findMany({
    where: {
      status: { in: ['CONFIRMED', 'IN_HOUSE'] },
      agencyId: { not: null },
      checkInDate: { lt: end },
      checkOutDate: { gt: start },
    },
    select: {
      agency: { select: { code: true, name: true } },
      checkInDate: true,
      checkOutDate: true,
    },
  });

  const map = new Map<string, AgencyForecastMonthRow>();
  const cursor = new Date(start);
  while (cursor < end) {
    const dateStr = toIso(cursor);
    const next = addDays(cursor, 1);
    for (const r of reservations) {
      if (!r.agency) continue;
      const k = `${r.agency.code}|${dateStr}`;
      if (!map.has(k)) {
        map.set(k, { agencyCode: r.agency.code, agencyName: r.agency.name, date: dateStr, expectedArrivals: 0, expectedDepartures: 0, roomNights: 0 });
      }
      const row = map.get(k)!;
      if (r.checkInDate >= cursor && r.checkInDate < next) row.expectedArrivals++;
      if (r.checkOutDate >= cursor && r.checkOutDate < next) row.expectedDepartures++;
      if (r.checkInDate < next && r.checkOutDate > cursor) row.roomNights++;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return { rows: [...map.values()].sort((a, b) => a.agencyCode.localeCompare(b.agencyCode) || a.date.localeCompare(b.date)) };
}

// ── segment-analysis ──

export interface SegmentAnalysisRow {
  segment: string;
  roomNights: number;
  revenue: number;
  avgRate: number;
  pctOfTotal: number;
}

export interface SegmentAnalysisResult {
  rows: SegmentAnalysisRow[];
  totalNights: number;
  totalRevenue: number;
}

export async function querySegmentAnalysis(from: Date, to: Date): Promise<SegmentAnalysisResult> {
  const start = dayStart(toIso(from));
  const end = addDays(dayStart(toIso(to)), 1);
  const reservations = await fetchReservations(start, end);

  const map = new Map<string, { nights: number; revenue: number }>();
  for (const r of reservations) {
    const seg = r.segment ?? 'N/A';
    const e = map.get(seg) ?? { nights: 0, revenue: 0 };
    e.nights++;
    e.revenue += Number(r.totalAmount);
    map.set(seg, e);
  }

  const totalNights = reservations.length;
  const totalRevenue = reservations.reduce((s, r) => s + Number(r.totalAmount), 0);

  const rows: SegmentAnalysisRow[] = [...map.entries()]
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .map(([segment, v]) => ({
      segment,
      roomNights: v.nights,
      revenue: Math.round(v.revenue * 100) / 100,
      avgRate: v.nights > 0 ? Math.round((v.revenue / v.nights) * 100) / 100 : 0,
      pctOfTotal: totalNights > 0 ? Math.round((v.nights / totalNights) * 1000) / 10 : 0,
    }));

  return { rows, totalNights, totalRevenue: Math.round(totalRevenue * 100) / 100 };
}

// ── nationality-monthly-occ ──

export interface NationalityMonthlyOccRow {
  nationality: string;
  month: string;
  roomNights: number;
}

export interface NationalityMonthlyOccResult {
  rows: NationalityMonthlyOccRow[];
}

export async function queryNationalityMonthlyOcc(from: Date, to: Date): Promise<NationalityMonthlyOccResult> {
  const start = dayStart(toIso(from));
  const end = addDays(dayStart(toIso(to)), 1);
  const reservations = await fetchReservations(start, end);

  const map = new Map<string, NationalityMonthlyOccRow>();
  for (const r of reservations) {
    const nat = r.guest.nationality ?? 'N/A';
    const month = toIso(r.checkInDate).slice(0, 7);
    const k = `${nat}|${month}`;
    const e = map.get(k) ?? { nationality: nat, month, roomNights: 0 };
    e.roomNights++;
    map.set(k, e);
  }

  return { rows: [...map.values()].sort((a, b) => a.nationality.localeCompare(b.nationality) || a.month.localeCompare(b.month)) };
}

// ── nationality-market-yoy ──

export interface NationalityMarketYoyRow {
  nationality: string;
  market: string;
  currentNights: number;
  priorNights: number;
  change: number;
}

export interface NationalityMarketYoyResult {
  rows: NationalityMarketYoyRow[];
}

export async function queryNationalityMarketYoy(from: Date, to: Date): Promise<NationalityMarketYoyResult> {
  const start = dayStart(toIso(from));
  const end = addDays(dayStart(toIso(to)), 1);
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  const priorStart = new Date(start);
  priorStart.setUTCFullYear(priorStart.getUTCFullYear() - 1);
  const priorEnd = addDays(priorStart, days);

  const [curRes, priorRes] = await Promise.all([
    fetchReservations(start, end),
    fetchReservations(priorStart, priorEnd),
  ]);

  const build = (res: ResWithAgency[]) => {
    const m = new Map<string, number>();
    for (const r of res) {
      const k = `${r.guest.nationality ?? 'N/A'}|${r.market ?? 'N/A'}`;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  };

  const curMap = build(curRes);
  const priorMap = build(priorRes);
  const allKeys = new Set([...curMap.keys(), ...priorMap.keys()]);

  const rows: NationalityMarketYoyRow[] = [...allKeys].sort().map((k) => {
    const [nationality, market] = k.split('|');
    const cur = curMap.get(k) ?? 0;
    const pri = priorMap.get(k) ?? 0;
    return { nationality, market, currentNights: cur, priorNights: pri, change: cur - pri };
  });

  return { rows };
}

// ── agency-profitability (SCREEN only) ──

export interface AgencyProfitabilityRow {
  agencyCode: string;
  agencyName: string;
  roomNights: number;
  revenue: number;
  commissionAmount: number;
  netRevenue: number;
  avgNetRate: number;
}

export interface AgencyProfitabilityResult {
  rows: AgencyProfitabilityRow[];
  totalRevenue: number;
  totalCommission: number;
  totalNet: number;
}

export async function queryAgencyProfitability(from: Date, to: Date): Promise<AgencyProfitabilityResult> {
  const start = dayStart(toIso(from));
  const end = addDays(dayStart(toIso(to)), 1);
  const reservations = await fetchReservations(start, end);

  const map = new Map<string, { code: string; name: string; nights: number; revenue: number; commPct: number }>();
  for (const r of reservations) {
    if (!r.agency) continue;
    const code = r.agency.code;
    const e = map.get(code) ?? { code, name: r.agency.name, nights: 0, revenue: 0, commPct: Number(r.agency.commissionPercent ?? 0) };
    e.nights++;
    e.revenue += Number(r.totalAmount);
    map.set(code, e);
  }

  const rows: AgencyProfitabilityRow[] = [...map.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .map((v) => {
      const comm = Math.round(v.revenue * v.commPct / 100 * 100) / 100;
      const net = Math.round((v.revenue - comm) * 100) / 100;
      return {
        agencyCode: v.code,
        agencyName: v.name,
        roomNights: v.nights,
        revenue: Math.round(v.revenue * 100) / 100,
        commissionAmount: comm,
        netRevenue: net,
        avgNetRate: v.nights > 0 ? Math.round((net / v.nights) * 100) / 100 : 0,
      };
    });

  return {
    rows,
    totalRevenue: rows.reduce((s, r) => s + r.revenue, 0),
    totalCommission: rows.reduce((s, r) => s + r.commissionAmount, 0),
    totalNet: rows.reduce((s, r) => s + r.netRevenue, 0),
  };
}
