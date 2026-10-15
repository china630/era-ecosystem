import { bakuCivilUtcDate } from '@era/satellite-kit/time';
import { addHotelDays, hotelDateKey } from '@/lib/hotel-calendar';
import { prisma } from '@/lib/prisma';
import { decimalToNumber } from '@/lib/decimal';
import { NightlyPriceMissingError, usesBarCalendar } from '@/lib/pricing/own-nightly-price';
import { PricingEngineError } from '@/lib/services/pricing-engine.service';
import { quoteReservationStay } from '@/lib/services/pricing-quote.service';
import { quoteBookingRate } from '@/lib/services/contract-pricing.service';
import { postCharge } from '@/lib/services/folio.service';
import {
  requireRevenueCodeByRole,
  revenueRoleIn,
  STAY_NIGHT_ROLES,
} from '@/lib/revenue-code-token';
import { getCurrentBusinessDate } from '@/lib/services/business-date.service';
import { replaceSlicesFromDate, resolveStaySliceForDate } from '@/lib/services/stay-slice.service';
import { recalcReservationDailyRates } from '@/lib/services/reservation-pricing.service';
import {
  classifyAmendmentFolioImpact,
  dateOnlyUtc,
  isoDate,
  rateAdjExternalRef,
} from '@/lib/services/door-type.policy';
import { fanOutClinicMedicalPackages } from '@/lib/integration/guest-lifecycle-events';

function dateOnly(d: Date): Date {
  return bakuCivilUtcDate(hotelDateKey(d));
}

export async function previewStayAmendment(input: {
  reservationId: string;
  effectiveDate: Date;
  roomTypeId: string;
  ratePlanId: string;
}) {
  const biz = await getCurrentBusinessDate();
  const effective = dateOnly(input.effectiveDate);
  if (effective < dateOnly(biz)) {
    throw new Error('Effective date cannot be before open business date');
  }
  const res = await prisma.reservation.findUnique({
    where: { id: input.reservationId },
    include: {
      dailyRates: true,
      folios: { include: { charges: { include: { revenueCode: true } } } },
      ratePlan: true,
    },
  });
  if (!res) throw new Error('Reservation not found');
  if (res.isLocked) throw new Error('Reservation is locked');

  const plan =
    input.ratePlanId === res.ratePlanId
      ? res.ratePlan
      : await prisma.ratePlan.findUnique({ where: { id: input.ratePlanId } });
  if (!plan) throw new Error('Rate plan not found');

  if (res.billingMode === 'COMP' || res.billingMode === 'HOUSE') {
    const nightlyRates: Array<{ date: string; amount: number }> = [];
    let cursor = hotelDateKey(res.checkInDate);
    const depart = hotelDateKey(res.checkOutDate);
    while (cursor < depart) {
      nightlyRates.push({ date: cursor, amount: 0 });
      cursor = addHotelDays(cursor, 1);
    }
    const nights: Array<{ date: string; old: number; next: number; locked: boolean }> = [];
    const lockedNights: string[] = [];
    for (const n of nightlyRates) {
      const existing = res.dailyRates.find((r) => isoDate(r.stayDate) === n.date);
      const locked = Boolean(existing?.manualFlag);
      if (locked) lockedNights.push(n.date);
      const old = existing ? decimalToNumber(existing.amount) : 0;
      nights.push({
        date: n.date,
        old,
        next: locked ? old : 0,
        locked,
      });
    }
    return { nights, folioImpact: 'NONE' as const, differenceAmount: 0, lockedNights };
  }

  const ownNights = async () => {
    const legacy = await quoteBookingRate({
      ratePlanId: plan.id,
      checkInDate: res.checkInDate,
      checkOutDate: res.checkOutDate,
      agencyId: res.agencyId ?? undefined,
    });
    if (legacy.adjustedNightly <= 0) {
      throw new NightlyPriceMissingError(res.id, plan.code);
    }
    return Array.from({ length: legacy.nights }, (_, i) => ({
      date: addHotelDays(res.checkInDate, i),
      amount: legacy.adjustedNightly,
    }));
  };

  let nightlyRates: Array<{ date: string; amount: number }>;
  if (!usesBarCalendar(plan)) {
    nightlyRates = await ownNights();
  } else {
    try {
      const quote = await quoteReservationStay({
        ratePlanId: plan.id,
        roomTypeId: input.roomTypeId,
        checkInDate: res.checkInDate,
        checkOutDate: res.checkOutDate,
        agencyId: res.agencyId ?? undefined,
        guests: res.adults + res.children1_0 + res.children5_2 + res.children11_6,
      });
      nightlyRates = quote.nightlyRates;
    } catch (err) {
      if (
        err instanceof PricingEngineError &&
        (err.code === 'BASE_PLAN_NOT_FOUND' || err.code === 'INVALID_DERIVATION')
      ) {
        nightlyRates = await ownNights();
      } else {
        throw err;
      }
    }
  }

  const stayPct = res.discountPercent != null ? decimalToNumber(res.discountPercent) : 0;
  const nights: Array<{ date: string; old: number; next: number; locked: boolean }> = [];
  const lockedNights: string[] = [];
  for (const n of nightlyRates) {
    const d = new Date(`${n.date}T00:00:00`);
    if (dateOnly(d) < effective) continue;
    const existing = res.dailyRates.find((r) => isoDate(r.stayDate) === n.date);
    const locked = Boolean(existing?.manualFlag);
    if (locked) lockedNights.push(n.date);
    let next = n.amount;
    if (!locked && stayPct > 0 && !res.useManualRate) {
      next = Math.round(next * (1 - stayPct / 100) * 100) / 100;
    }
    if (locked && existing) next = decimalToNumber(existing.amount);
    nights.push({
      date: n.date,
      old: existing ? decimalToNumber(existing.amount) : n.amount,
      next,
      locked,
    });
  }

  const todayKey = isoDate(biz);
  const tonightPosted = res.folios.some((f) =>
    f.charges.some(
      (c) =>
        isoDate(c.businessDate) === todayKey &&
        revenueRoleIn(c.revenueCode, STAY_NIGHT_ROLES),
    ),
  );
  const tonight = nights.find((n) => n.date === todayKey);
  const effectiveIsToday = effective.getTime() === dateOnly(biz).getTime();
  let differenceAmount = 0;
  if (tonightPosted && tonight && effectiveIsToday) {
    differenceAmount = Math.round((tonight.next - tonight.old) * 100) / 100;
  }
  const folioImpact = classifyAmendmentFolioImpact({
    tonightPosted,
    effectiveIsToday,
    differenceAmount,
  });

  return { nights, folioImpact, differenceAmount, lockedNights };
}

export async function applyStayAmendment(input: {
  reservationId: string;
  effectiveDate: Date;
  roomTypeId: string;
  ratePlanId: string;
}) {
  const preview = await previewStayAmendment(input);
  const res = await prisma.reservation.findUnique({
    where: { id: input.reservationId },
    include: {
      ratePlan: true,
      room: true,
      paxGuests: { orderBy: { sortOrder: 'asc' } },
    },
  });
  if (!res) throw new Error('Reservation not found');
  const newPlan = await prisma.ratePlan.findUnique({ where: { id: input.ratePlanId } });
  const { ratePlanRequiresGuestPackage, normalizeMedicalPackageCode } = await import(
    '@/lib/services/medical-package-resolve.service'
  );
  const guestPackageOnStay = newPlan ? ratePlanRequiresGuestPackage(newPlan) : false;
  if (guestPackageOnStay) {
    const named = res.paxGuests.filter(
      (p) => p.guestId || p.firstName?.trim() || p.lastName?.trim(),
    );
    const rows = named.length > 0 ? named : res.paxGuests;
    if (rows.length === 0 || rows.some((p) => !normalizeMedicalPackageCode(p.medicalPackageCode))) {
      throw new Error('Select a medical package for each guest');
    }
  }
  const biz = await getCurrentBusinessDate();
  const effective = dateOnly(input.effectiveDate);

  await replaceSlicesFromDate({
    reservationId: input.reservationId,
    fromDate: effective,
    roomTypeId: input.roomTypeId,
    ratePlanId: input.ratePlanId,
    checkOutDate: res.checkOutDate,
    keepRoomId: res.roomId,
  });

  const headerSlice = await resolveStaySliceForDate(input.reservationId, biz);
  if (headerSlice) {
    await prisma.reservation.update({
      where: { id: input.reservationId },
      data: {
        roomTypeId: headerSlice.roomTypeId,
        ratePlanId: headerSlice.ratePlanId,
        mealPlanId: newPlan?.mealPlanId ?? undefined,
      },
    });
  }

  if (!res.useManualRate) {
    await recalcReservationDailyRates(input.reservationId, { remainingFrom: effective });
  }

  if (preview.folioImpact === 'DIFFERENCE_LINE' && preview.differenceAmount !== 0) {
    const adj = await requireRevenueCodeByRole('RATE_ADJ');
    const externalRef = rateAdjExternalRef(input.reservationId, isoDate(biz));
    const existing = await prisma.folioCharge.findFirst({ where: { externalRef } });
    if (!existing) {
      await postCharge({
        reservationId: input.reservationId,
        revenueCodeId: adj.id,
        amount: preview.differenceAmount,
        qty: 1,
        description: `RATE_ADJ ${isoDate(biz)}`,
        businessDate: dateOnlyUtc(biz),
        externalRef,
      });
    }
  }

  if (input.ratePlanId !== res.ratePlanId) {
    await prisma.stayTariffChange.create({
      data: {
        organizationId: res.organizationId,
        reservationId: input.reservationId,
        effectiveAt: effective,
        fromRatePlanId: res.ratePlanId,
        toRatePlanId: input.ratePlanId,
        fromCode: res.ratePlan.code,
        toCode: newPlan?.code ?? null,
      },
    });
  }

  if (!guestPackageOnStay) {
    await prisma.reservationGuest.updateMany({
      where: { reservationId: input.reservationId, medicalPackageCode: { not: null } },
      data: { medicalPackageCode: null },
    });
    await prisma.reservation.update({
      where: { id: input.reservationId },
      data: { medicalPackageCode: null },
    });
  }

  if (res.status === 'IN_HOUSE') {
    const nextPax = await prisma.reservationGuest.findMany({
      where: { reservationId: input.reservationId },
      orderBy: { sortOrder: 'asc' },
      include: { guest: true },
    });
    const previousCodes = res.paxGuests.map((g) => g.medicalPackageCode ?? '').join('|');
    const nextCodes = nextPax.map((g) => g.medicalPackageCode ?? '').join('|');
    if (previousCodes !== nextCodes) {
      const previousProgram =
        res.paxGuests.find((g) => g.medicalPackageCode)?.medicalPackageCode ??
        res.medicalPackageCode ??
        undefined;
      await fanOutClinicMedicalPackages({
        status: res.status,
        reservationId: input.reservationId,
        roomNumber: res.room?.roomNumber ?? undefined,
        checkInDate: res.checkInDate.toISOString(),
        checkOutDate: res.checkOutDate.toISOString(),
        previousProgramCode: previousProgram ?? undefined,
        pax: nextPax,
      }).catch((e) => console.error('Stay product event failed', e));
    }
  }

  return { ok: true, preview };
}
