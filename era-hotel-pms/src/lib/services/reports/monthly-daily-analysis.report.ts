import { eachCivilDay, round2, ymdParam } from '@/lib/reports/civil-days';
import { safeDiv, safePct } from '@/lib/reports/ratio';
import {
  indexStayDays,
  loadCapacity,
  loadChargeDays,
  loadRevenueCodes,
  loadStays,
  type HotelCapacity,
  type StayDay,
} from './stay-ledger';

export interface OccupancyDay {
  date: string;
  roomsSold: number;
  pax: number;
  arrivals: number;
  departures: number;
  complimentary: number;
  houseUse: number;
  roomRevenue: number;
  totalRevenue: number;
  roomPct: number | null;
  bedPct: number | null;
  adr: number | null;
  revPar: number | null;
}

export interface OccupancySeries {
  from: string;
  to: string;
  roomCapacity: number;
  bedCapacity: number | null;
  days: OccupancyDay[];
}

/** One row per Asia/Baku civil day with share-aware rooms sold and VAT-inclusive revenue. */
export async function queryOccupancySeries(fromYmd: string, toYmd: string): Promise<OccupancySeries> {
  const to = toYmd < fromYmd ? fromYmd : toYmd;
  const [capacity, stays, chargeDays, codes] = await Promise.all([
    loadCapacity(),
    loadStays(fromYmd, to),
    loadChargeDays(fromYmd, to),
    loadRevenueCodes(),
  ]);
  return { from: fromYmd, to, ...seriesFrom(capacity, stays, chargeDays, codes, eachCivilDay(fromYmd, to)) };
}

function seriesFrom(
  capacity: HotelCapacity,
  stays: Awaited<ReturnType<typeof loadStays>>,
  chargeDays: Awaited<ReturnType<typeof loadChargeDays>>,
  codes: Awaited<ReturnType<typeof loadRevenueCodes>>,
  dates: string[],
): Pick<OccupancySeries, 'roomCapacity' | 'bedCapacity' | 'days'> {
  const revenue = new Map<string, { room: number; total: number }>();
  for (const c of chargeDays) {
    const r = revenue.get(c.day) ?? { room: 0, total: 0 };
    r.total += c.gross;
    if (codes.get(c.revenueCodeId)?.isRoom) r.room += c.gross;
    revenue.set(c.day, r);
  }
  const index: Map<string, StayDay> =
    dates.length > 0 ? indexStayDays(stays, dates[0], dates[dates.length - 1]) : new Map();
  const days = dates.map((date): OccupancyDay => {
    const s = index.get(date);
    const n = s?.night ?? { sold: 0, pax: 0, complimentary: 0, houseUse: 0 };
    const rev = revenue.get(date) ?? { room: 0, total: 0 };
    return {
      date,
      roomsSold: n.sold,
      pax: n.pax,
      arrivals: s?.arrivals.rooms ?? 0,
      departures: s?.departures.rooms ?? 0,
      complimentary: n.complimentary,
      houseUse: n.houseUse,
      roomRevenue: round2(rev.room),
      totalRevenue: round2(rev.total),
      roomPct: safePct(n.sold, capacity.roomCapacity),
      bedPct: safePct(n.pax, capacity.bedCapacity),
      adr: safeDiv(rev.room, n.sold),
      revPar: safeDiv(rev.room, capacity.roomCapacity),
    };
  });
  return { roomCapacity: capacity.roomCapacity, bedCapacity: capacity.bedCapacity, days };
}

export function queryMonthlyDailyAnalysis(monthStart: Date | string, businessDate: Date | string): Promise<OccupancySeries> {
  return queryOccupancySeries(ymdParam(monthStart), ymdParam(businessDate));
}
