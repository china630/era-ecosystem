import { prisma } from '@/lib/prisma';

export type CubeDimension = 'date' | 'department' | 'agency' | 'revenueCode' | 'roomType';

export interface CubeCell {
  date: string;
  dimension: string;
  amount: number;
  count: number;
}

export interface CubeResult {
  cube: string;
  dimension: CubeDimension;
  rows: CubeCell[];
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

function dimOf(value: CubeDimension, row: { date: string; department: string; agency: string; revenueCode: string; roomType: string }): string {
  switch (value) {
    case 'date':
      return row.date;
    case 'department':
      return row.department;
    case 'agency':
      return row.agency;
    case 'revenueCode':
      return row.revenueCode;
    case 'roomType':
      return row.roomType;
  }
}

function rollup(cells: CubeCell[]): CubeCell[] {
  const map = new Map<string, CubeCell>();
  for (const c of cells) {
    const key = `${c.date}|${c.dimension}`;
    const prev = map.get(key);
    if (prev) {
      prev.amount += c.amount;
      prev.count += c.count;
    } else {
      map.set(key, { ...c });
    }
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date) || a.dimension.localeCompare(b.dimension));
}

export async function queryRevenueCube(
  from: Date,
  to: Date,
  dimension: CubeDimension = 'department',
): Promise<CubeResult> {
  const fromIso = toIso(from);
  const toIsoDate = toIso(to);
  const charges = await prisma.folioCharge.findMany({
    where: {
      businessDate: { gte: dayStart(fromIso), lte: addDays(dayStart(toIsoDate), 1) },
    },
    select: {
      amount: true,
      businessDate: true,
      department: { select: { name: true, code: true } },
      revenueCode: { select: { name: true, code: true } },
      folio: {
        select: {
          reservation: {
            select: {
              agency: { select: { name: true } },
              roomType: { select: { code: true } },
            },
          },
        },
      },
    },
  });

  const cells: CubeCell[] = charges.map((c) => {
    const raw = {
      date: toIso(c.businessDate),
      department: c.department?.name ?? c.department?.code ?? '—',
      agency: c.folio.reservation?.agency?.name ?? '—',
      revenueCode: c.revenueCode.name ?? c.revenueCode.code,
      roomType: c.folio.reservation?.roomType?.code ?? '—',
    };
    return {
      date: raw.date,
      dimension: dimOf(dimension, raw),
      amount: Number(c.amount),
      count: 1,
    };
  });

  return { cube: 'revenue-cube', dimension, rows: rollup(cells) };
}

export async function queryFolioCube(
  from: Date,
  to: Date,
  dimension: CubeDimension = 'department',
): Promise<CubeResult> {
  const fromIso = toIso(from);
  const toEnd = addDays(dayStart(toIso(to)), 1);
  const [charges, payments] = await Promise.all([
    prisma.folioCharge.findMany({
      where: { businessDate: { gte: dayStart(fromIso), lt: toEnd } },
      select: {
        amount: true,
        businessDate: true,
        department: { select: { name: true } },
      },
    }),
    prisma.folioPayment.findMany({
      where: { createdAt: { gte: dayStart(fromIso), lt: toEnd } },
      select: { amount: true, createdAt: true, paymentMethod: true },
    }),
  ]);

  const cells: CubeCell[] = [
    ...charges.map((c) => ({
      date: toIso(c.businessDate),
      dimension: dimension === 'date' ? toIso(c.businessDate) : (c.department?.name ?? 'charge'),
      amount: Number(c.amount),
      count: 1,
    })),
    ...payments.map((p) => ({
      date: toIso(p.createdAt),
      dimension: dimension === 'date' ? toIso(p.createdAt) : `pay:${p.paymentMethod}`,
      amount: -Number(p.amount),
      count: 1,
    })),
  ];

  return { cube: 'folio-cube', dimension, rows: rollup(cells) };
}

export async function queryReservationCube(
  from: Date,
  to: Date,
  dimension: CubeDimension = 'roomType',
): Promise<CubeResult> {
  const windowStart = dayStart(toIso(from));
  const windowEnd = addDays(dayStart(toIso(to)), 1);
  const reservations = await prisma.reservation.findMany({
    where: {
      status: { in: ['CONFIRMED', 'IN_HOUSE', 'CHECKED_OUT', 'OPTION'] },
      checkInDate: { lt: windowEnd },
      checkOutDate: { gt: windowStart },
    },
    select: {
      checkInDate: true,
      totalAmount: true,
      agency: { select: { name: true } },
      roomType: { select: { code: true } },
    },
  });

  const cells: CubeCell[] = reservations.map((r) => {
    const raw = {
      date: toIso(r.checkInDate),
      department: '—',
      agency: r.agency?.name ?? '—',
      revenueCode: '—',
      roomType: r.roomType.code,
    };
    return {
      date: raw.date,
      dimension: dimOf(dimension, raw),
      amount: Number(r.totalAmount),
      count: 1,
    };
  });

  return { cube: 'reservation-cube', dimension, rows: rollup(cells) };
}

export async function queryAgencySalesCube(
  from: Date,
  to: Date,
  dimension: CubeDimension = 'agency',
): Promise<CubeResult> {
  const windowStart = dayStart(toIso(from));
  const windowEnd = addDays(dayStart(toIso(to)), 1);
  const reservations = await prisma.reservation.findMany({
    where: {
      agencyId: { not: null },
      createdAt: { gte: windowStart, lt: windowEnd },
    },
    select: {
      createdAt: true,
      totalAmount: true,
      agency: { select: { name: true } },
      roomType: { select: { code: true } },
    },
  });

  const cells: CubeCell[] = reservations.map((r) => {
    const raw = {
      date: toIso(r.createdAt),
      department: '—',
      agency: r.agency?.name ?? '—',
      revenueCode: '—',
      roomType: r.roomType.code,
    };
    return {
      date: raw.date,
      dimension: dimOf(dimension, raw),
      amount: Number(r.totalAmount),
      count: 1,
    };
  });

  return { cube: 'agency-sales-cube', dimension, rows: rollup(cells) };
}
