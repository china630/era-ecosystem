import { prisma } from '@/lib/prisma';
import { decimalToNumber, toDecimal } from '@/lib/decimal';
import { quoteReservationStay } from '@/lib/services/pricing-quote.service';
import { postCharge } from '@/lib/services/folio.service';
import {
  computeChildNightlyAddon,
  reservationChildGroups,
  type ChildPricingRow,
} from '@/lib/services/pricing-engine-core';

async function loadChildPricingMatrix(): Promise<ChildPricingRow[]> {
  const rows = await prisma.childPricingMatrix.findMany({
    where: { active: true },
    orderBy: { ageFrom: 'asc' },
  });
  return rows.map((row) => ({
    ageFrom: row.ageFrom,
    ageTo: row.ageTo,
    discountPercent: decimalToNumber(row.discountPercent),
  }));
}

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
    include: { ratePlan: true, dailyRates: true, room: true },
  });
  if (!res) throw new Error('Reservation not found');
  if (res.isLocked) throw new Error('Reservation is locked');

  const roomTypeId = res.room?.roomTypeId ?? res.ratePlan.roomTypeId;
  if (!roomTypeId) throw new Error('Room type required for pricing recalc');

  const quoteResult = await quoteReservationStay({
    ratePlanId: res.ratePlanId,
    roomTypeId,
    checkInDate: res.checkInDate,
    checkOutDate: res.checkOutDate,
    agencyId: res.agencyId ?? undefined,
    guests: res.adults + res.children1_0 + res.children5_2 + res.children11_6,
  });

  const childMatrix = await loadChildPricingMatrix();
  const childGroups = reservationChildGroups({
    children1_0: res.children1_0,
    children5_2: res.children5_2,
    children11_6: res.children11_6,
  });

  const nights = eachNight(res.checkInDate, res.checkOutDate);
  const nightlyByDate = new Map(quoteResult.nightlyRates.map((n) => [n.date, n.amount]));
  const adultNightly =
    res.useManualRate && res.manualDailyRate != null
      ? decimalToNumber(res.manualDailyRate)
      : quoteResult.adultNightly;

  const childAddonNightly = decimalToNumber(
    computeChildNightlyAddon(adultNightly, childGroups, childMatrix),
  );
  const nightly = adultNightly + childAddonNightly;

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
      const dateKey = night.toISOString().slice(0, 10);
      const barNight = nightlyByDate.get(dateKey);
      const baseAmount = (barNight ?? adultNightly) + childAddonNightly;
      rows.push({
        stayDate: night,
        amount: baseAmount,
        manualFlag: false,
        currencyCode: quoteResult.currency,
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
    quote: quoteResult,
    childAddonNightly,
    adultNightly,
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
