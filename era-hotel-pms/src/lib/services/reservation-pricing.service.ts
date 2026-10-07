import { bakuCivilUtcDate } from '@era/satellite-kit/time';
import { addHotelDays, hotelDateKey } from '@/lib/hotel-calendar';
import { prisma } from '@/lib/prisma';
import { decimalToNumber, toDecimal } from '@/lib/decimal';
import { MEDICAL_PACKAGE_CODES } from '@/lib/services/medical-package-resolve.service';
import { ownerPackageNightlySell } from '@/lib/services/nafta-package-compose-apply.service';
import { quoteReservationStay } from '@/lib/services/pricing-quote.service';
import { PricingEngineError } from '@/lib/services/pricing-engine.service';
import { getCurrentBusinessDate } from '@/lib/services/business-date.service';
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
  return bakuCivilUtcDate(hotelDateKey(d));
}

async function closedNightKeys(reservationId: string): Promise<{ bizKey: string; posted: Set<string> }> {
  const bizKey = hotelDateKey(await getCurrentBusinessDate());
  const charges = await prisma.folioCharge.findMany({
    where: { folio: { reservationId } },
    select: { businessDate: true, revenueCode: { select: { code: true } } },
  });
  const posted = new Set<string>();
  for (const charge of charges) {
    const code = charge.revenueCode.code;
    if (code === 'ROOM' || code === 'PKG' || code === 'RATE_ADJ') {
      posted.add(hotelDateKey(charge.businessDate));
    }
  }
  return { bizKey, posted };
}

function nightAlreadyConsumed(stayDate: Date, bizKey: string, posted: Set<string>): boolean {
  const key = hotelDateKey(stayDate);
  return key < bizKey || posted.has(key);
}

function eachNight(from: Date, to: Date): Date[] {
  const nights: Date[] = [];
  let cur = hotelDateKey(from);
  const end = hotelDateKey(to);
  while (cur < end) {
    nights.push(bakuCivilUtcDate(cur));
    cur = addHotelDays(cur, 1);
  }
  return nights;
}

const PACKAGE_CODE_SET = new Set<string>(MEDICAL_PACKAGE_CODES);

function stayPackageCodes(input: {
  medicalPackageCode: string | null;
  paxGuests: Array<{ medicalPackageCode: string | null }>;
}): string[] {
  const raw =
    input.paxGuests.length > 0
      ? input.paxGuests.map((g) => g.medicalPackageCode)
      : [input.medicalPackageCode];
  return raw
    .map((c) => (c ?? '').trim().toUpperCase())
    .filter((c) => PACKAGE_CODE_SET.has(c));
}

async function writeOwnerNightly(
  res: {
    id: string;
    organizationId: string;
    checkInDate: Date;
    checkOutDate: Date;
    dailyRates: Array<{
      stayDate: Date;
      amount: { toString(): string };
      manualFlag: boolean;
      currencyCode: string | null;
      fixPrice: boolean;
      discountPct: { toString(): string } | null;
    }>;
  },
  nightly: number,
  remainingFrom?: Date,
) {
  const nights = eachNight(res.checkInDate, res.checkOutDate);
  const fromKey = remainingFrom ? dateOnly(remainingFrom) : null;
  const closed = await closedNightKeys(res.id);
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
    if (
      existing &&
      (nightAlreadyConsumed(night, closed.bizKey, closed.posted) ||
        existing.manualFlag ||
        existing.fixPrice ||
        (fromKey && dateOnly(night) < fromKey))
    ) {
      rows.push({
        stayDate: night,
        amount: decimalToNumber(existing.amount as never),
        manualFlag: existing.manualFlag,
        currencyCode: existing.currencyCode ?? 'AZN',
        fixPrice: existing.fixPrice,
        discountPct: existing.discountPct ? decimalToNumber(existing.discountPct as never) : null,
      });
      continue;
    }
    rows.push({
      stayDate: night,
      amount: nightly,
      manualFlag: false,
      currencyCode: 'AZN',
      fixPrice: false,
      discountPct: null,
    });
  }
  if (rows.length === 0) throw new Error('No nights');
  await prisma.$transaction([
    prisma.reservationDailyRate.deleteMany({ where: { reservationId: res.id } }),
    ...rows.map((r) =>
      prisma.reservationDailyRate.create({
        data: {
          organizationId: res.organizationId,
          reservationId: res.id,
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
      where: { id: res.id },
      data: { totalAmount: toDecimal(rows.reduce((s, r) => s + r.amount, 0)) },
    }),
  ]);
  return {
    dailyRates: rows,
    totalAmount: rows.reduce((s, r) => s + r.amount, 0),
    quote: null,
    childAddonNightly: 0,
    adultNightly: nightly,
  };
}

export async function recalcReservationDailyRates(
  reservationId: string,
  opts?: { remainingFrom?: Date },
) {
  const res = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      ratePlan: true,
      dailyRates: true,
      room: true,
      staySlices: true,
      paxGuests: { orderBy: { sortOrder: 'asc' } },
    },
  });
  if (!res) throw new Error('Reservation not found');
  if (res.isLocked) throw new Error('Reservation is locked');

  const packageCodes = stayPackageCodes(res);
  if (packageCodes.length > 0 || res.ratePlan.medicalFlag) {
    let nightly: number | null;
    if (packageCodes.length > 0) {
      nightly = await ownerPackageNightlySell(res.checkInDate, packageCodes);
      if (nightly == null) {
        throw new Error('Package sell price is not set for this stay date');
      }
    } else {
      nightly = decimalToNumber(res.ratePlan.pricePerNight);
    }
    return writeOwnerNightly(res, nightly, opts?.remainingFrom);
  }

  const { resolveStaySliceForDate } = await import('@/lib/services/stay-slice.service');
  const quoteDate = opts?.remainingFrom ?? res.checkInDate;
  const slice = await resolveStaySliceForDate(reservationId, quoteDate);
  const roomTypeId = slice?.roomTypeId ?? res.roomTypeId ?? res.ratePlan.roomTypeId;
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

  let quoteResult: Awaited<ReturnType<typeof quoteReservationStay>>;
  try {
    quoteResult = await quoteReservationStay({
      ratePlanId: slice?.ratePlanId ?? res.ratePlanId,
      roomTypeId,
      checkInDate: res.checkInDate,
      checkOutDate: res.checkOutDate,
      agencyId: res.agencyId ?? undefined,
      guests: res.adults + res.children1_0 + res.children5_2 + res.children11_6,
    });
  } catch (err) {
    if (err instanceof PricingEngineError) {
      return writeOwnerNightly(res, decimalToNumber(res.ratePlan.pricePerNight), opts?.remainingFrom);
    }
    throw err;
  }

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
  const closed = await closedNightKeys(reservationId);
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
    if (
      existing &&
      (existing.manualFlag ||
        existing.fixPrice ||
        nightAlreadyConsumed(night, closed.bizKey, closed.posted))
    ) {
      rows.push({
        stayDate: night,
        amount: decimalToNumber(existing.amount),
        manualFlag: existing.manualFlag,
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
          organizationId: res.organizationId,
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
  if (res.status !== 'IN_HOUSE') {
    throw new Error('Room nights post after check-in, one night at a time');
  }

  if (res.ratePlan.medicalFlag) {
    const { postNightlyPackageCharges } = await import('@/lib/services/san-package.service');
    const biz = await getCurrentBusinessDate();
    const result = await postNightlyPackageCharges(reservationId, biz);
    const key = hotelDateKey(biz);
    return result.skipped
      ? { posted: [] as string[], skipped: [key] }
      : { posted: [key], skipped: [] as string[] };
  }

  const revenueRoom = await prisma.revenueCode.findFirst({ where: { code: 'ROOM' } });
  if (!revenueRoom) throw new Error('Revenue code ROOM not configured');

  let rates = res.dailyRates;
  if (rates.length === 0) {
    const recalc = await recalcReservationDailyRates(reservationId);
    rates = recalc.dailyRates.map((r) => ({
      id: '',
      organizationId: res.organizationId,
      reservationId,
      stayDate: r.stayDate,
      amount: toDecimal(r.amount),
      manualFlag: r.manualFlag,
      currencyCode: r.currencyCode,
      fixPrice: r.fixPrice,
      discountPct: r.discountPct != null ? toDecimal(r.discountPct) : null,
    }));
  }

  const postedNights: string[] = [];
  const skipped: string[] = [];

  const closed = await closedNightKeys(reservationId);
  for (const row of rates) {
    const biz = dateOnly(row.stayDate);
    if (hotelDateKey(biz) !== closed.bizKey) {
      skipped.push(hotelDateKey(biz));
      continue;
    }
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
    postedNights.push(biz.toISOString().slice(0, 10));
  }

  return { posted: postedNights, skipped };
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
  const closed = await closedNightKeys(reservationId);
  const openNights = nights.filter((stayDate) => {
    if (nightAlreadyConsumed(stayDate, closed.bizKey, closed.posted)) return false;
    const existing = res.dailyRates.find(
      (row) => hotelDateKey(row.stayDate) === hotelDateKey(stayDate),
    );
    return !existing?.fixPrice;
  });
  if (openNights.length === 0) throw new Error('All nights are locked');
  await prisma.$transaction([
    prisma.reservation.update({
      where: { id: reservationId },
      data: {
        useManualRate: true,
        manualDailyRate: toDecimal(nightly),
      },
    }),
    ...openNights.map((stayDate) =>
      prisma.reservationDailyRate.upsert({
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
      }),
    ),
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
  const closed = await closedNightKeys(reservationId);
  const unlocked = nights.filter((stayDate) => {
    if (nightAlreadyConsumed(stayDate, closed.bizKey, closed.posted)) return false;
    const existing = res.dailyRates.find(
      (row) => hotelDateKey(row.stayDate) === hotelDateKey(stayDate),
    );
    return !existing?.fixPrice;
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
  const res = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { dailyRates: true },
  });
  if (!res) throw new Error('Reservation not found');
  if (percent < 0 || percent > 100) throw new Error('Percent must be 0–100');
  const closed = await closedNightKeys(reservationId);
  const nights = eachNight(res.checkInDate, res.checkOutDate);
  const open = nights.filter((stayDate) => {
    if (nightAlreadyConsumed(stayDate, closed.bizKey, closed.posted)) return false;
    const existing = res.dailyRates.find(
      (row) => hotelDateKey(row.stayDate) === hotelDateKey(stayDate),
    );
    return !existing?.fixPrice;
  });
  if (open.length === 0) throw new Error('All nights are locked');
  await prisma.$transaction([
    prisma.reservation.update({
      where: { id: reservationId },
      data: {
        discountPercent: toDecimal(percent),
        discountActive: percent > 0,
      },
    }),
    ...open.map((stayDate) => {
      const existing = res.dailyRates.find(
        (d) => hotelDateKey(d.stayDate) === hotelDateKey(stayDate),
      );
      const base = existing ? decimalToNumber(existing.amount) : decimalToNumber(res.manualDailyRate ?? 0);
      const amount = Math.round(base * (1 - percent / 100) * 100) / 100;
      return prisma.reservationDailyRate.upsert({
        where: { reservationId_stayDate: { reservationId, stayDate } },
        create: {
          reservationId,
          stayDate,
          amount: toDecimal(amount),
          manualFlag: false,
          currencyCode: 'AZN',
          fixPrice: false,
          discountPct: toDecimal(percent),
        },
        update: {
          amount: toDecimal(amount),
          discountPct: toDecimal(percent),
        },
      });
    }),
  ]);
  const rows = await listDailyRates(reservationId);
  const totalAmount = rows.reduce((s, r) => s + r.amount, 0);
  await prisma.reservation.update({
    where: { id: reservationId },
    data: { totalAmount: toDecimal(totalAmount) },
  });
  return { dailyRates: rows, totalAmount, quote: null, childAddonNightly: 0, adultNightly: 0 };
}
