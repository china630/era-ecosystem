import { prisma } from '@/lib/prisma';
import { decimalToNumber, toDecimal } from '@/lib/decimal';
import { quoteBookingRate } from '@/lib/services/contract-pricing.service';
import { postCharge } from '@/lib/services/folio.service';

function dateOnly(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function eachNight(from: Date, to: Date): Date[] {
  const nights: Date[] = [];
  const cur = dateOnly(from);
  const end = dateOnly(to);
  while (cur < end) {
    nights.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return nights;
}

export async function recalcReservationDailyRates(reservationId: string) {
  const res = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { ratePlan: true, dailyRates: true },
  });
  if (!res) throw new Error('Reservation not found');
  if (res.isLocked) throw new Error('Reservation is locked');

  const quote = await quoteBookingRate({
    ratePlanId: res.ratePlanId,
    checkInDate: res.checkInDate,
    checkOutDate: res.checkOutDate,
    agencyId: res.agencyId ?? undefined,
  });

  const nights = eachNight(res.checkInDate, res.checkOutDate);
  const nightly =
    res.useManualRate && res.manualDailyRate != null
      ? decimalToNumber(res.manualDailyRate)
      : quote.adjustedNightly;

  const discountPct = res.discountActive ? 0 : null;
  const rows: Array<{
    stayDate: Date;
    amount: number;
    manualFlag: boolean;
    currencyCode: string;
    fixPrice: boolean;
    discountPct: number | null;
  }> = [];
  for (const night of nights) {
    const existing = res.dailyRates.find(
      (d) => d.stayDate.toDateString() === night.toDateString(),
    );
    if (existing?.manualFlag) {
      rows.push({
        stayDate: night,
        amount: decimalToNumber(existing.amount),
        manualFlag: true,
        currencyCode: existing.currencyCode ?? 'AZN',
        fixPrice: existing.fixPrice,
        discountPct: existing.discountPct ? decimalToNumber(existing.discountPct) : null,
      });
    } else {
      rows.push({
        stayDate: night,
        amount: nightly,
        manualFlag: false,
        currencyCode: 'AZN',
        fixPrice: res.useManualRate,
        discountPct,
      });
    }
  }

  await prisma.$transaction([
    prisma.reservationDailyRate.deleteMany({ where: { reservationId } }),
    ...rows.map((r) =>
      prisma.reservationDailyRate.create({
        data: {
          reservationId,
          stayDate: r.stayDate,
          amount: toDecimal(r.amount),
          manualFlag: r.manualFlag,
          currencyCode: r.currencyCode,
          fixPrice: r.fixPrice,
          discountPct: r.discountPct != null ? toDecimal(r.discountPct) : null,
        },
      }),
    ),
    prisma.reservation.update({
      where: { id: reservationId },
      data: { totalAmount: toDecimal(rows.reduce((s, r) => s + r.amount, 0)) },
    }),
  ]);

  return {
    dailyRates: rows,
    totalAmount: rows.reduce((s, r) => s + r.amount, 0),
    quote,
  };
}

export async function chargeAllRoomNights(reservationId: string) {
  const res = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      ratePlan: true,
      folios: { include: { charges: true } },
      dailyRates: true,
    },
  });
  if (!res) throw new Error('Reservation not found');
  if (res.isLocked) throw new Error('Reservation is locked');

  const revenueRoom = await prisma.revenueCode.findUnique({ where: { code: 'ROOM' } });
  if (!revenueRoom) throw new Error('Revenue code ROOM not configured');

  let rates = res.dailyRates;
  if (rates.length === 0) {
    const recalc = await recalcReservationDailyRates(reservationId);
    rates = recalc.dailyRates.map((r) => ({
      id: '',
      reservationId,
      stayDate: r.stayDate,
      amount: toDecimal(r.amount),
      manualFlag: r.manualFlag,
      currencyCode: r.currencyCode,
      fixPrice: r.fixPrice,
      discountPct: r.discountPct != null ? toDecimal(r.discountPct) : null,
    }));
  }

  const posted: string[] = [];
  const skipped: string[] = [];

  for (const row of rates) {
    const biz = dateOnly(row.stayDate);
    const already = res.folios.some((f) =>
      f.charges.some(
        (c) =>
          c.revenueCodeId === revenueRoom.id &&
          c.businessDate.toDateString() === biz.toDateString(),
      ),
    );
    if (already) {
      skipped.push(biz.toISOString().slice(0, 10));
      continue;
    }
    await postCharge({
      reservationId,
      revenueCodeId: revenueRoom.id,
      amount: decimalToNumber(row.amount),
      qty: 1,
      description: `Room charge ${biz.toISOString().slice(0, 10)}`,
      businessDate: biz,
    });
    posted.push(biz.toISOString().slice(0, 10));
  }

  return { posted, skipped };
}

export async function listDailyRates(reservationId: string) {
  const rows = await prisma.reservationDailyRate.findMany({
    where: { reservationId },
    orderBy: { stayDate: 'asc' },
  });
  return rows.map((r) => ({
    id: r.id,
    stayDate: r.stayDate,
    amount: decimalToNumber(r.amount),
    currencyCode: r.currencyCode,
    fixPrice: r.fixPrice,
    discountPct: r.discountPct ? decimalToNumber(r.discountPct) : null,
    manualFlag: r.manualFlag,
  }));
}
