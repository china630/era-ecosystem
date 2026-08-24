import { prisma } from '@/lib/prisma';
import { decimalToNumber, toDecimal } from '@/lib/decimal';
import { quoteReservationStay } from '@/lib/services/pricing-quote.service';
import { postCharge } from '@/lib/services/folio.service';
import {
  applyLoadBasedAdjustment,
  computeChildNightlyAddon,
  computeOccupancyNightlySupplement,
  reservationChildGroups,
  type ChildPricingRow,
} from '@/lib/services/pricing-engine-core';
import { splitStayAmounts } from '@/lib/services/door-type.policy';
import { getHotelPolicy } from '@/lib/services/hotel-policy.service';
import {
  estimateOccupancyPctForNight,
  resolveLoadBasedAdjustmentPercent,
} from '@/lib/services/yield-pricing.service';

async function loadChildPricingMatrix(): Promise<ChildPricingRow[]> {
  const rows = await prisma.childPricingMatrix.findMany({
    where: { active: true },
    orderBy: { ageFrom: 'asc' },
  });
  return rows.map((row) => ({
    ageFrom: row.ageFrom,
    ageTo: row.ageTo,
    discountPercent: decimalToNumber(row.discountPercent),
    amountOverride:
      row.amountOverride == null ? null : decimalToNumber(row.amountOverride),
    freeCount: row.freeCount,
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

export async function recalcReservationDailyRates(
  reservationId: string,
  opts?: { remainingFrom?: Date },
) {
  const res = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { ratePlan: true, dailyRates: true, room: true, staySlices: true },
  });
  if (!res) throw new Error('Reservation not found');
  if (res.isLocked) throw new Error('Reservation is locked');

  const { resolveStaySliceForDate } = await import('@/lib/services/stay-slice.service');
  const quoteDate = opts?.remainingFrom ?? res.checkInDate;
  const slice = await resolveStaySliceForDate(reservationId, quoteDate);
  const roomTypeId = slice?.roomTypeId ?? res.room?.roomTypeId ?? res.ratePlan.roomTypeId;
  if (!roomTypeId) throw new Error('Room type required for pricing recalc');

  if (res.useManualRate && opts?.remainingFrom) {
    return {
      dailyRates: res.dailyRates.map((d) => ({
        stayDate: d.stayDate,
        amount: decimalToNumber(d.amount),
        manualFlag: d.manualFlag,
        currencyCode: d.currencyCode ?? 'AZN',
        fixPrice: d.fixPrice,
        discountPct: d.discountPct ? decimalToNumber(d.discountPct) : null,
      })),
      totalAmount: res.dailyRates.reduce((s, r) => s + decimalToNumber(r.amount), 0),
      quote: null,
      childAddonNightly: 0,
      adultNightly: 0,
      frozenManual: true,
    };
  }

  const quoteResult = await quoteReservationStay({
    ratePlanId: slice?.ratePlanId ?? res.ratePlanId,
    roomTypeId,
    checkInDate: res.checkInDate,
    checkOutDate: res.checkOutDate,
    agencyId: res.agencyId ?? undefined,
    guests: res.adults + res.children1_0 + res.children5_2 + res.children11_6,
  });

  const policy = await getHotelPolicy();
  const childMatrix = await loadChildPricingMatrix();
  const childGroups = reservationChildGroups({
    children1_0: res.children1_0,
    children5_2: res.children5_2,
    children11_6: res.children11_6,
  });

  const occupancySupplement =
    policy.occupancyPricingEnabled && !res.shareEligible
      ? decimalToNumber(
          computeOccupancyNightlySupplement({
            adults: res.adults,
          baseOccupancy: res.ratePlan.baseOccupancy ?? 1,
          extraAdultAmount:
            res.ratePlan.extraAdultAmount == null
              ? null
              : decimalToNumber(res.ratePlan.extraAdultAmount),
          thirdAdultAmount:
            res.ratePlan.thirdAdultAmount == null
              ? null
              : decimalToNumber(res.ratePlan.thirdAdultAmount),
          extraBeds: res.extraBeds ?? 0,
          extraBedAmount:
            res.ratePlan.extraBedAmount == null
              ? null
              : decimalToNumber(res.ratePlan.extraBedAmount),
        }),
      )
      : 0;

  const nights = eachNight(res.checkInDate, res.checkOutDate);
  const nightlyByDate = new Map(quoteResult.nightlyRates.map((n) => [n.date, n.amount]));
  const adultNightly =
    res.useManualRate && res.manualDailyRate != null
      ? decimalToNumber(res.manualDailyRate)
      : quoteResult.adultNightly;

  const childAddonNightly = decimalToNumber(
    computeChildNightlyAddon(adultNightly, childGroups, childMatrix, {
      useAbsolutePricing: policy.childAbsolutePricingEnabled,
    }),
  );

  const stayPct =
    res.discountPercent != null ? decimalToNumber(res.discountPercent) : 0;
  const remainingFrom = opts?.remainingFrom ? dateOnly(opts.remainingFrom) : null;
  const discountPct = stayPct > 0 ? stayPct : res.discountActive ? 0 : null;
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
    if (remainingFrom && dateOnly(night) < remainingFrom && existing) {
      rows.push({
        stayDate: night,
        amount: decimalToNumber(existing.amount),
        manualFlag: existing.manualFlag,
        currencyCode: existing.currencyCode ?? 'AZN',
        fixPrice: existing.fixPrice,
        discountPct: existing.discountPct ? decimalToNumber(existing.discountPct) : null,
      });
      continue;
    }
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
      let baseAmount = (barNight ?? adultNightly) + occupancySupplement + childAddonNightly;
      if (policy.loadBasedPricingEnabled) {
        const occPct = await estimateOccupancyPctForNight(night);
        const adj = await resolveLoadBasedAdjustmentPercent(occPct);
        baseAmount = decimalToNumber(applyLoadBasedAdjustment(baseAmount, adj));
      }
      if (stayPct > 0) {
        baseAmount = Math.round(baseAmount * (1 - stayPct / 100) * 100) / 100;
      }
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

  const revenueRoom = await prisma.revenueCode.findFirst({ where: { code: 'ROOM' } });
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

export async function spreadManualNightly(reservationId: string, nightly: number) {
  const res = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { dailyRates: true },
  });
  if (!res) throw new Error('Reservation not found');
  if (res.isLocked) throw new Error('Reservation is locked');
  const nights = eachNight(res.checkInDate, res.checkOutDate);
  await prisma.$transaction([
    prisma.reservation.update({
      where: { id: reservationId },
      data: {
        useManualRate: true,
        manualDailyRate: toDecimal(nightly),
        discountPercent: null,
        discountActive: false,
      },
    }),
    ...nights.map((stayDate) => {
      const existing = res.dailyRates.find(
        (d) => d.stayDate.toDateString() === stayDate.toDateString(),
      );
      if (existing?.manualFlag) {
        return prisma.reservationDailyRate.update({
          where: { id: existing.id },
          data: {},
        });
      }
      return prisma.reservationDailyRate.upsert({
        where: { reservationId_stayDate: { reservationId, stayDate } },
        create: {
          reservationId,
          stayDate,
          amount: toDecimal(nightly),
          manualFlag: true,
          currencyCode: 'AZN',
          fixPrice: true,
        },
        update: {
          amount: toDecimal(nightly),
          manualFlag: true,
          fixPrice: true,
        },
      });
    }),
  ]);
  return recalcReservationDailyRates(reservationId);
}

export async function spreadStayTotal(reservationId: string, total: number) {
  const res = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { dailyRates: true },
  });
  if (!res) throw new Error('Reservation not found');
  if (res.isLocked) throw new Error('Reservation is locked');
  const nights = eachNight(res.checkInDate, res.checkOutDate);
  if (nights.length === 0) throw new Error('No nights');
  const unlocked = nights.filter((stayDate) => {
    const existing = res.dailyRates.find(
      (d) => d.stayDate.toDateString() === stayDate.toDateString(),
    );
    return !existing?.manualFlag;
  });
  if (unlocked.length === 0) throw new Error('All nights are locked');
  const amounts = splitStayAmounts(total, unlocked.length);
  const nightlyHint = amounts[0] ?? 0;
  await prisma.$transaction([
    prisma.reservation.update({
      where: { id: reservationId },
      data: {
        useManualRate: true,
        manualDailyRate: toDecimal(nightlyHint),
        discountPercent: null,
        discountActive: false,
      },
    }),
    ...unlocked.map((stayDate, i) =>
      prisma.reservationDailyRate.upsert({
        where: { reservationId_stayDate: { reservationId, stayDate } },
        create: {
          reservationId,
          stayDate,
          amount: toDecimal(amounts[i] ?? 0),
          manualFlag: true,
          currencyCode: 'AZN',
          fixPrice: true,
        },
        update: {
          amount: toDecimal(amounts[i] ?? 0),
          manualFlag: true,
          fixPrice: true,
        },
      }),
    ),
  ]);
  return recalcReservationDailyRates(reservationId);
}

export async function applyStayPercent(reservationId: string, percent: number) {
  const res = await prisma.reservation.findUnique({ where: { id: reservationId } });
  if (!res) throw new Error('Reservation not found');
  if (res.useManualRate) {
    throw new Error('Stay % and Manual Price are mutually exclusive');
  }
  if (percent < 0 || percent > 100) throw new Error('Percent must be 0–100');
  await prisma.reservation.update({
    where: { id: reservationId },
    data: {
      discountPercent: toDecimal(percent),
      discountActive: percent > 0,
      useManualRate: false,
    },
  });
  return recalcReservationDailyRates(reservationId);
}
