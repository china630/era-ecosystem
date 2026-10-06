import type { Prisma, PrismaClient } from '@prisma/client';
import { addHotelDays, hotelDateKey } from '@/lib/hotel-calendar';
import { toDecimal } from '@/lib/decimal';
import { parseElektrawebDate, num, str } from '@/lib/integration/elektraweb-bridge/normalize';

type RateDb = PrismaClient | Prisma.TransactionClient;

export type ElektraNightLine = {
  externalRef: string;
  stayDate: Date;
  amount: number;
  discountPct: number | null;
  fixPrice: boolean;
  currencyCode: string;
};

const NIGHT_DATE_KEYS = ['STAYDATE', 'NIGHTDATE', 'RESDATE', 'PRICEDATE', 'RATEDATE'] as const;
const NIGHT_PRICE_KEYS = ['RATEPRICE', 'NIGHTPRICE', 'MANUALRATE', 'MANUALDAILYRATE', 'DAILYPRICE', 'PRICE'] as const;

function firstNum(row: Record<string, unknown>, keys: readonly string[]): number | null {
  for (const key of keys) {
    const value = num(row[key]);
    if (value != null) return value;
  }
  return null;
}

function truthyFlag(value: unknown): boolean {
  if (value === true || value === 1) return true;
  const text = str(value)?.toLowerCase();
  return text === '1' || text === 'true' || text === 'y' || text === 'yes';
}

/** One pricing-grid row. A stay header (check-in and check-out, no night date) is not a night. */
export function elektraNightLine(row: Record<string, unknown>): ElektraNightLine | null {
  const externalRef = str(row.RESID) ?? str(row.ID);
  if (!externalRef) return null;
  const nightRaw = NIGHT_DATE_KEYS.map((key) => row[key]).find((value) => value != null && value !== '');
  const checkIn = parseElektrawebDate(row.CHECKIN);
  const checkOut = parseElektrawebDate(row.CHECKOUT);
  const spansStay =
    checkIn != null &&
    checkOut != null &&
    hotelDateKey(checkOut) > addHotelDays(hotelDateKey(checkIn), 1);
  if (nightRaw == null && spansStay) return null;
  const stayDate = parseElektrawebDate(nightRaw ?? row.DATE ?? row.DAY);
  const amount = firstNum(row, NIGHT_PRICE_KEYS);
  if (!stayDate || amount == null) return null;
  if (nightRaw == null && checkIn && checkOut && hotelDateKey(checkOut) > addHotelDays(hotelDateKey(checkIn), 1)) {
    return null;
  }
  const discount = firstNum(row, ['DISCOUNTPCT', 'DISCPCT', 'DISCOUNT']);
  return {
    externalRef,
    stayDate,
    amount,
    discountPct: discount,
    fixPrice: truthyFlag(row.FIXPRICE ?? row.FIX ?? row.FIXED),
    currencyCode: (str(row.CURRENCY) ?? str(row.CUR) ?? str(row.CURRENCYCODE) ?? 'AZN').toUpperCase(),
  };
}

export function spreadStayNights(input: {
  checkIn: Date;
  checkOut: Date;
  nightly: number | null;
  total: number | null;
}): Array<{ stayDate: Date; amount: number; manualFlag: boolean }> {
  const nights: Date[] = [];
  let cursor = hotelDateKey(input.checkIn);
  const end = hotelDateKey(input.checkOut);
  while (cursor < end) {
    nights.push(new Date(`${cursor}T00:00:00.000Z`));
    cursor = addHotelDays(cursor, 1);
  }
  if (nights.length === 0) return [];
  const round = (n: number) => Math.round(n * 100) / 100;
  if (input.nightly != null) {
    const rows = nights.map((stayDate) => ({
      stayDate,
      amount: round(input.nightly as number),
      manualFlag: false,
    }));
    if (input.total != null) {
      const sum = round(rows.reduce((s, row) => s + row.amount, 0));
      const delta = round(input.total - sum);
      if (Math.abs(delta) >= 0.01) {
        const last = rows[rows.length - 1]!;
        last.amount = round(last.amount + delta);
        last.manualFlag = true;
      }
    }
    return rows;
  }
  if (input.total == null) return [];
  const base = round(input.total / nights.length);
  const rows = nights.map((stayDate) => ({ stayDate, amount: base, manualFlag: false }));
  const last = rows[rows.length - 1]!;
  last.amount = round(input.total - base * (nights.length - 1));
  if (last.amount !== base) last.manualFlag = true;
  return rows;
}

async function refreshTotal(db: RateDb, reservationId: string) {
  const rows = await db.reservationDailyRate.findMany({
    where: { reservationId },
    select: { stayDate: true, amount: true },
  });
  const total = rows.reduce((sum, row) => sum + Number(row.amount), 0);
  await db.reservation.update({
    where: { id: reservationId },
    data: { totalAmount: toDecimal(Math.round(total * 100) / 100) },
  });
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = Number(row.amount).toFixed(2);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let mode = '';
  let modeCount = 0;
  for (const [key, count] of counts) {
    if (count > modeCount) {
      mode = key;
      modeCount = count;
    }
  }
  for (const row of rows) {
    if (Number(row.amount).toFixed(2) === mode) continue;
    await db.reservationDailyRate.updateMany({
      where: { reservationId, stayDate: row.stayDate },
      data: { manualFlag: true },
    });
  }
}

export async function writeElektraNightLine(
  db: RateDb,
  input: { reservationId: string; organizationId: string; night: ElektraNightLine },
) {
  const stayDate = new Date(`${hotelDateKey(input.night.stayDate)}T00:00:00.000Z`);
  await db.reservationDailyRate.upsert({
    where: { reservationId_stayDate: { reservationId: input.reservationId, stayDate } },
    create: {
      organizationId: input.organizationId,
      reservationId: input.reservationId,
      stayDate,
      amount: toDecimal(input.night.amount),
      currencyCode: input.night.currencyCode,
      discountPct: input.night.discountPct == null ? null : toDecimal(input.night.discountPct),
      fixPrice: input.night.fixPrice,
      manualFlag: true,
    },
    update: {
      amount: toDecimal(input.night.amount),
      currencyCode: input.night.currencyCode,
      discountPct: input.night.discountPct == null ? null : toDecimal(input.night.discountPct),
      fixPrice: input.night.fixPrice,
      manualFlag: true,
    },
  });
  await refreshTotal(db, input.reservationId);
}

/** Header-only price. Does not replace nights already stored from the pricing grid. */
export async function fillDailyRatesFromHeader(
  db: RateDb,
  input: {
    reservationId: string;
    organizationId: string;
    checkIn: Date;
    checkOut: Date;
    nightly: number | null;
    total: number | null;
  },
) {
  const nightly = input.nightly && input.nightly > 0 ? input.nightly : null;
  const total = input.total && input.total > 0 ? input.total : null;
  if (nightly == null && total == null) return;
  const existing = await db.reservationDailyRate.count({ where: { reservationId: input.reservationId } });
  if (existing > 0) return;
  const nights = spreadStayNights({ ...input, nightly, total });
  for (const night of nights) {
    await db.reservationDailyRate.upsert({
      where: { reservationId_stayDate: { reservationId: input.reservationId, stayDate: night.stayDate } },
      create: {
        organizationId: input.organizationId,
        reservationId: input.reservationId,
        stayDate: night.stayDate,
        amount: toDecimal(night.amount),
        currencyCode: 'AZN',
        fixPrice: night.manualFlag,
        manualFlag: true,
      },
      update: {
        amount: toDecimal(night.amount),
        fixPrice: night.manualFlag,
        manualFlag: true,
      },
    });
  }
  if (nights.length > 0) await refreshTotal(db, input.reservationId);
}
