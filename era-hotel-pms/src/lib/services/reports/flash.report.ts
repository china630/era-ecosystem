import { prisma } from '@/lib/prisma';
import {
  addCivilDays,
  civilDay,
  civilWindow,
  eachCivilDay,
  monthStartYmd,
  round2,
  splitGross,
  yearStartYmd,
  ymdParam,
} from '@/lib/reports/civil-days';
import { safeDiv, safePct } from '@/lib/reports/ratio';
import { indexStayDays, loadCapacity, loadChargeDays, loadRevenueCodes, loadStays } from './stay-ledger';

export type FlashColumnKey = 'today' | 'tomorrow' | 'month' | 'year' | 'period';

export interface FlashColumnSpec {
  key: FlashColumnKey;
  from: string;
  to: string;
  /** Future column: occupancy only, no revenue or payments. */
  forecast?: boolean;
}

export interface FlashDepartment {
  code: string;
  name: string;
  gross: number;
  net: number;
  vat: number;
}

export interface FlashColumn {
  key: FlashColumnKey;
  from: string;
  to: string;
  forecast: boolean;
  days: number;
  roomNightsAvailable: number;
  bedNightsAvailable: number | null;
  roomsSold: number;
  pax: number;
  adults: number;
  children: number;
  complimentary: number;
  houseUse: number;
  arrivals: number;
  arrivalPax: number;
  departures: number;
  departurePax: number;
  roomPct: number | null;
  bedPct: number | null;
  roomRevenue: number | null;
  adr: number | null;
  revPar: number | null;
  totalGross: number | null;
  totalNet: number | null;
  totalVat: number | null;
  departments: FlashDepartment[];
  payments: { method: string; amount: number }[];
  paymentsTotal: number | null;
}

export interface FlashResult {
  anchor: string;
  roomCapacity: number;
  bedCapacity: number | null;
  ooo: number;
  oos: number;
  columns: FlashColumn[];
}

export async function queryFlash(anchor: string, specs: FlashColumnSpec[]): Promise<FlashResult> {
  const from = specs.reduce((m, s) => (s.from < m ? s.from : m), specs[0].from);
  const to = specs.reduce((m, s) => (s.to > m ? s.to : m), specs[0].to);
  const window = civilWindow(from, to);

  const [capacity, stays, charges, codes, payments] = await Promise.all([
    loadCapacity(),
    loadStays(from, to),
    loadChargeDays(from, to),
    loadRevenueCodes(),
    prisma.folioPayment.findMany({
      where: { createdAt: { gte: window.gte, lt: window.lt } },
      select: { createdAt: true, amount: true, kind: true, paymentMethod: true },
    }),
  ]);
  const stayDays = indexStayDays(stays, from, to);
  const paymentDays = payments.map((p) => ({
    day: civilDay(p.createdAt),
    method: p.paymentMethod,
    amount: (p.kind === 'REFUND' ? -1 : 1) * Number(p.amount),
  }));

  const columns = specs.map((spec): FlashColumn => {
    const days = eachCivilDay(spec.from, spec.to);
    let roomsSold = 0;
    let pax = 0;
    let adults = 0;
    let children = 0;
    let complimentary = 0;
    let houseUse = 0;
    let arrivals = 0;
    let arrivalPax = 0;
    let departures = 0;
    let departurePax = 0;
    for (const day of days) {
      const s = stayDays.get(day);
      if (!s) continue;
      roomsSold += s.night.sold;
      pax += s.night.pax;
      adults += s.night.adults;
      children += s.night.children;
      complimentary += s.night.complimentary;
      houseUse += s.night.houseUse;
      arrivals += s.arrivals.rooms;
      arrivalPax += s.arrivals.pax;
      departures += s.departures.rooms;
      departurePax += s.departures.pax;
    }

    const roomNightsAvailable = capacity.roomCapacity * days.length;
    const bedNightsAvailable = capacity.bedCapacity == null ? null : capacity.bedCapacity * days.length;
    const forecast = Boolean(spec.forecast);

    const deptMap = new Map<string, FlashDepartment>();
    let roomGross = 0;
    if (!forecast) {
      for (const c of charges) {
        if (c.day < spec.from || c.day > spec.to) continue;
        const code = codes.get(c.revenueCodeId);
        const split = splitGross(c.gross, code?.vatRate ?? 0);
        const key = code?.departmentCode ?? 'OTHER';
        const dept = deptMap.get(key) ?? { code: key, name: code?.departmentName ?? 'Other', gross: 0, net: 0, vat: 0 };
        dept.gross += split.gross;
        dept.net += split.net;
        dept.vat += split.vat;
        deptMap.set(key, dept);
        if (code?.isRoom) roomGross += c.gross;
      }
    }
    const departments = [...deptMap.values()]
      .map((d) => ({ ...d, gross: round2(d.gross), net: round2(d.net), vat: round2(d.vat) }))
      .sort((a, b) => b.gross - a.gross);

    const payMap = new Map<string, number>();
    if (!forecast) {
      for (const p of paymentDays) {
        if (p.day < spec.from || p.day > spec.to) continue;
        payMap.set(p.method, (payMap.get(p.method) ?? 0) + p.amount);
      }
    }
    const paymentRows = [...payMap.entries()]
      .map(([method, amount]) => ({ method, amount: round2(amount) }))
      .sort((a, b) => a.method.localeCompare(b.method));

    const totalGross = forecast ? null : round2(departments.reduce((s, d) => s + d.gross, 0));
    const roomRevenue = forecast ? null : round2(roomGross);
    return {
      key: spec.key,
      from: spec.from,
      to: spec.to,
      forecast,
      days: days.length,
      roomNightsAvailable,
      bedNightsAvailable,
      roomsSold,
      pax,
      adults,
      children,
      complimentary,
      houseUse,
      arrivals,
      arrivalPax,
      departures,
      departurePax,
      roomPct: safePct(roomsSold, roomNightsAvailable),
      bedPct: safePct(pax, bedNightsAvailable),
      roomRevenue,
      adr: roomRevenue == null ? null : safeDiv(roomRevenue, roomsSold),
      revPar: roomRevenue == null ? null : safeDiv(roomRevenue, roomNightsAvailable),
      totalGross,
      totalNet: forecast ? null : round2(departments.reduce((s, d) => s + d.net, 0)),
      totalVat: forecast ? null : round2(departments.reduce((s, d) => s + d.vat, 0)),
      departments,
      payments: paymentRows,
      paymentsTotal: forecast ? null : round2(paymentRows.reduce((s, p) => s + p.amount, 0)),
    };
  });

  return {
    anchor,
    roomCapacity: capacity.roomCapacity,
    bedCapacity: capacity.bedCapacity,
    ooo: capacity.ooo,
    oos: capacity.oos,
    columns,
  };
}

/** Elektra Daily Management: Today, Tomorrow (forecast), Month to date, Year to date. */
export function dailyFlashSpecs(anchor: string): FlashColumnSpec[] {
  const tomorrow = addCivilDays(anchor, 1);
  return [
    { key: 'today', from: anchor, to: anchor },
    { key: 'tomorrow', from: tomorrow, to: tomorrow, forecast: true },
    { key: 'month', from: monthStartYmd(anchor), to: anchor },
    { key: 'year', from: yearStartYmd(anchor), to: anchor },
  ];
}

export function queryDailyManagement(businessDate: Date | string): Promise<FlashResult> {
  const anchor = ymdParam(businessDate);
  return queryFlash(anchor, dailyFlashSpecs(anchor));
}

export function queryDailyManagementSummary(businessDate: Date | string): Promise<FlashResult> {
  const anchor = ymdParam(businessDate);
  return queryFlash(anchor, dailyFlashSpecs(anchor).filter((s) => s.key !== 'tomorrow'));
}

export function queryDateRangeManagement(from: Date | string, to: Date | string): Promise<FlashResult> {
  const fromYmd = ymdParam(from);
  const toYmd = ymdParam(to);
  return queryFlash(toYmd, [{ key: 'period', from: fromYmd, to: toYmd < fromYmd ? fromYmd : toYmd }]);
}
