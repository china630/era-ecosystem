import { prisma } from '@/lib/prisma';
import { civilDay, civilWindow, round2, stayNightsIn, ymdParam } from '@/lib/reports/civil-days';

export interface GuestLedgerRow {
  reservationId: string;
  roomNumber: string | null;
  roomType: string;
  guestName: string;
  arrival: string;
  departure: string;
  nights: number;
  adults: number;
  children: number;
  rate: number;
  agencyName: string | null;
  segment: string | null;
  vipType: string | null;
  charges: number;
  payments: number;
  balance: number;
}

const LEDGER_SELECT = {
  id: true,
  checkInDate: true,
  checkOutDate: true,
  adults: true,
  children11_6: true,
  children5_2: true,
  children1_0: true,
  segment: true,
  vipType: true,
  guest: { select: { fullName: true } },
  room: { select: { roomNumber: true } },
  roomType: { select: { code: true, name: true } },
  agency: { select: { name: true } },
  ratePlan: { select: { pricePerNight: true } },
  dailyRates: { select: { stayDate: true, amount: true } },
  folios: {
    select: {
      charges: { select: { amount: true } },
      payments: { select: { amount: true, kind: true } },
    },
  },
} as const;

type LedgerReservation = Awaited<ReturnType<typeof loadLedger>>[number];

function loadLedger(where: object) {
  return prisma.reservation.findMany({
    where,
    select: LEDGER_SELECT,
    orderBy: [{ room: { roomNumber: 'asc' } }, { checkInDate: 'asc' }],
  });
}

function toLedgerRow(r: LedgerReservation, anchor: string): GuestLedgerRow {
  const arrival = civilDay(r.checkInDate);
  const departure = civilDay(r.checkOutDate);
  const nights = stayNightsIn(r.checkInDate, r.checkOutDate, arrival, departure);
  const nightRate = r.dailyRates.find((d) => civilDay(d.stayDate) === anchor);
  let charges = 0;
  let payments = 0;
  for (const folio of r.folios) {
    for (const c of folio.charges) charges += Number(c.amount);
    for (const p of folio.payments) payments += p.kind === 'REFUND' ? -Number(p.amount) : Number(p.amount);
  }
  return {
    reservationId: r.id,
    roomNumber: r.room?.roomNumber ?? null,
    roomType: r.roomType.code,
    guestName: r.guest.fullName,
    arrival,
    departure,
    nights,
    adults: r.adults ?? 0,
    children: (r.children11_6 ?? 0) + (r.children5_2 ?? 0) + (r.children1_0 ?? 0),
    rate: round2(nightRate ? Number(nightRate.amount) : Number(r.ratePlan.pricePerNight)),
    agencyName: r.agency?.name ?? null,
    segment: r.segment,
    vipType: r.vipType,
    charges: round2(charges),
    payments: round2(payments),
    balance: round2(charges - payments),
  };
}

export interface InHouseResult {
  businessDate: string;
  rows: GuestLedgerRow[];
}

/** Guests in house on the night of `businessDate` (Asia/Baku). */
export async function queryInHouse(businessDate: Date | string): Promise<InHouseResult> {
  const anchor = ymdParam(businessDate);
  const day = civilWindow(anchor, anchor);
  const rows = await loadLedger({
    status: { in: ['IN_HOUSE', 'CHECKED_OUT'] },
    checkInDate: { lt: day.lt },
    checkOutDate: { gte: day.lt },
  });
  return { businessDate: anchor, rows: rows.map((r) => toLedgerRow(r, anchor)) };
}

export interface MainCurrentResult {
  businessDate: string;
  inHouse: GuestLedgerRow[];
  arrivals: GuestLedgerRow[];
  departures: GuestLedgerRow[];
}

/** Elektra Main Current: in-house ledger plus the day's expected arrivals and departures. */
export async function queryMainCurrent(businessDate: Date | string): Promise<MainCurrentResult> {
  const anchor = ymdParam(businessDate);
  const day = civilWindow(anchor, anchor);
  const [inHouse, arrivals, departures] = await Promise.all([
    loadLedger({
      status: { in: ['IN_HOUSE', 'CHECKED_OUT'] },
      checkInDate: { lt: day.lt },
      checkOutDate: { gte: day.lt },
    }),
    loadLedger({
      status: { in: ['CONFIRMED', 'IN_HOUSE', 'CHECKED_OUT'] },
      checkInDate: { gte: day.gte, lt: day.lt },
    }),
    loadLedger({
      status: { in: ['IN_HOUSE', 'CHECKED_OUT'] },
      checkOutDate: { gte: day.gte, lt: day.lt },
    }),
  ]);
  return {
    businessDate: anchor,
    inHouse: inHouse.map((r) => toLedgerRow(r, anchor)),
    arrivals: arrivals.map((r) => toLedgerRow(r, anchor)),
    departures: departures.map((r) => toLedgerRow(r, anchor)),
  };
}
