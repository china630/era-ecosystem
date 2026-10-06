import { prisma } from '@/lib/prisma';
import { civilDay, civilWindow, eachCivilDay, vatRateFromTag } from '@/lib/reports/civil-days';

export const SOLD_STATUSES = ['CONFIRMED', 'IN_HOUSE', 'CHECKED_OUT'] as const;

export interface StayRow {
  id: string;
  status: string;
  roomId: string | null;
  roomCount: number;
  checkIn: Date;
  checkOut: Date;
  /** Civil arrival / departure days, computed once per stay. */
  inYmd: string;
  outYmd: string;
  adults: number;
  children: number;
  accomType: string | null;
  totalAmount: number;
}

export interface RevenueCodeInfo {
  id: string;
  code: string;
  name: string;
  departmentCode: string;
  departmentName: string;
  vatRate: number;
  isRoom: boolean;
}

export interface ChargeDayRow {
  day: string;
  revenueCodeId: string;
  gross: number;
}

export interface HotelCapacity {
  roomCapacity: number;
  bedCapacity: number | null;
  physicalRooms: number;
  ooo: number;
  oos: number;
}

const ROOM_DEPARTMENT_CODES = new Set(['ROOM', 'ROOMS', 'ACC', 'ACCOM', 'ACCOMMODATION']);

/** Stays overlapping civil days `fromYmd..toYmd` (inclusive), departure day included for departure counts. */
export async function loadStays(
  fromYmd: string,
  toYmd: string,
  statuses: readonly string[] = SOLD_STATUSES,
): Promise<StayRow[]> {
  const window = civilWindow(fromYmd, toYmd);
  const rows = await prisma.reservation.findMany({
    where: {
      status: { in: [...statuses] as never },
      checkInDate: { lt: window.lt },
      checkOutDate: { gte: window.gte },
    },
    select: {
      id: true,
      status: true,
      roomId: true,
      roomCount: true,
      checkInDate: true,
      checkOutDate: true,
      adults: true,
      children11_6: true,
      children5_2: true,
      children1_0: true,
      accomType: true,
      totalAmount: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    roomId: r.roomId,
    roomCount: Math.max(1, r.roomCount ?? 1),
    checkIn: r.checkInDate,
    checkOut: r.checkOutDate,
    inYmd: civilDay(r.checkInDate),
    outYmd: civilDay(r.checkOutDate),
    adults: r.adults ?? 0,
    children: (r.children11_6 ?? 0) + (r.children5_2 ?? 0) + (r.children1_0 ?? 0),
    accomType: r.accomType,
    totalAmount: Number(r.totalAmount),
  }));
}

export interface NightStats {
  sold: number;
  pax: number;
  adults: number;
  children: number;
  complimentary: number;
  houseUse: number;
}

function accomKind(value: string | null): 'COMP' | 'HOUSE' | null {
  const v = (value ?? '').trim().toUpperCase();
  if (v.startsWith('COMP')) return 'COMP';
  if (v.startsWith('HOUSE') || v === 'HU') return 'HOUSE';
  return null;
}

export interface StayDay {
  night: NightStats;
  arrivals: { rooms: number; pax: number };
  departures: { rooms: number; pax: number };
}

const emptyDay = (): StayDay => ({
  night: { sold: 0, pax: 0, adults: 0, children: 0, complimentary: 0, houseUse: 0 },
  arrivals: { rooms: 0, pax: 0 },
  departures: { rooms: 0, pax: 0 },
});

/**
 * Per-day occupancy for `fromYmd..toYmd` in one pass over the stays (cost = total nights).
 * Share rooms count once per physical room; unassigned stays count `roomCount`.
 */
export function indexStayDays(stays: StayRow[], fromYmd: string, toYmd: string): Map<string, StayDay> {
  const days = eachCivilDay(fromYmd, toYmd);
  const position = new Map(days.map((d, i) => [d, i]));
  const out = new Map(days.map((d) => [d, emptyDay()]));
  const rooms = days.map(() => new Set<string>());

  for (const s of stays) {
    const pax = s.adults + s.children;
    const arrival = out.get(s.inYmd);
    if (arrival) {
      arrival.arrivals.rooms += s.roomCount;
      arrival.arrivals.pax += pax;
    }
    const departure = out.get(s.outYmd);
    if (departure) {
      departure.departures.rooms += s.roomCount;
      departure.departures.pax += pax;
    }

    if (s.outYmd <= fromYmd || s.inYmd > toYmd) continue;
    const start = s.inYmd < fromYmd ? 0 : (position.get(s.inYmd) ?? 0);
    const end = s.outYmd > toYmd ? days.length : (position.get(s.outYmd) ?? days.length);
    const kind = accomKind(s.accomType);
    for (let i = start; i < end; i++) {
      let counted = 0;
      if (s.roomId) {
        if (!rooms[i].has(s.roomId)) {
          rooms[i].add(s.roomId);
          counted = 1;
        }
      } else {
        counted = s.roomCount;
      }
      const n = out.get(days[i])!.night;
      n.sold += counted;
      n.adults += s.adults;
      n.children += s.children;
      n.pax += pax;
      if (kind === 'COMP') n.complimentary += counted;
      if (kind === 'HOUSE') n.houseUse += counted;
    }
  }
  return out;
}

export async function loadRevenueCodes(): Promise<Map<string, RevenueCodeInfo>> {
  const codes = await prisma.revenueCode.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      taxTag: true,
      department: { select: { code: true, name: true } },
      _count: { select: { ratePlansRoom: true } },
    },
  });
  return new Map(
    codes.map((c) => {
      const departmentCode = c.department?.code ?? 'OTHER';
      return [
        c.id,
        {
          id: c.id,
          code: c.code,
          name: c.name,
          departmentCode,
          departmentName: c.department?.name ?? 'Other',
          vatRate: vatRateFromTag(c.taxTag),
          isRoom: ROOM_DEPARTMENT_CODES.has(departmentCode.toUpperCase()) || c._count.ratePlansRoom > 0,
        },
      ];
    }),
  );
}

/** Charge totals per civil business day and revenue code. */
export async function loadChargeDays(fromYmd: string, toYmd: string): Promise<ChargeDayRow[]> {
  const grouped = await prisma.folioCharge.groupBy({
    by: ['businessDate', 'revenueCodeId'],
    where: { businessDate: civilWindow(fromYmd, toYmd) },
    _sum: { amount: true },
  });
  const map = new Map<string, ChargeDayRow>();
  for (const g of grouped) {
    const day = civilDay(g.businessDate);
    const key = `${day}|${g.revenueCodeId}`;
    const prev = map.get(key);
    const gross = Number(g._sum.amount ?? 0);
    if (prev) prev.gross += gross;
    else map.set(key, { day, revenueCodeId: g.revenueCodeId, gross });
  }
  return [...map.values()];
}

export async function loadCapacity(): Promise<HotelCapacity> {
  const [profile, rooms] = await Promise.all([
    prisma.hotelProfile.findFirst({ select: { roomCapacity: true, bedCapacity: true } }),
    prisma.room.findMany({ where: { deleted: false, disabled: false }, select: { status: true, inventoryStatus: true } }),
  ]);
  const ooo = rooms.filter((r) => r.inventoryStatus === 'OOO' || (!r.inventoryStatus && r.status === 'OOO')).length;
  const oos = rooms.filter((r) => r.inventoryStatus === 'OOS' || (!r.inventoryStatus && r.status === 'OOS')).length;
  return {
    roomCapacity: profile ? profile.roomCapacity : rooms.length,
    bedCapacity: profile?.bedCapacity ?? null,
    physicalRooms: rooms.length,
    ooo,
    oos,
  };
}
