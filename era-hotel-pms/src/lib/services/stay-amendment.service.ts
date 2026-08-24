import { prisma } from '@/lib/prisma';
import { decimalToNumber } from '@/lib/decimal';
import { quoteReservationStay } from '@/lib/services/pricing-quote.service';
import { postCharge } from '@/lib/services/folio.service';
import { getCurrentBusinessDate } from '@/lib/services/business-date.service';
import { replaceSlicesFromDate, resolveStaySliceForDate } from '@/lib/services/stay-slice.service';
import { recalcReservationDailyRates } from '@/lib/services/reservation-pricing.service';
import {
  classifyAmendmentFolioImpact,
  dateOnlyUtc,
  isoDate,
  rateAdjExternalRef,
} from '@/lib/services/door-type.policy';
import { dispatchStayProductChanged } from '@/lib/integration/guest-lifecycle-events';

function dateOnly(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
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

  const quote = await quoteReservationStay({
    ratePlanId: input.ratePlanId,
    roomTypeId: input.roomTypeId,
    checkInDate: res.checkInDate,
    checkOutDate: res.checkOutDate,
    agencyId: res.agencyId ?? undefined,
    guests: res.adults + res.children1_0 + res.children5_2 + res.children11_6,
  });

  const stayPct = res.discountPercent != null ? decimalToNumber(res.discountPercent) : 0;
  const nights: Array<{ date: string; old: number; next: number; locked: boolean }> = [];
  const lockedNights: string[] = [];
  for (const n of quote.nightlyRates) {
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
        ['ROOM', 'PKG', 'RATE_ADJ'].includes(c.revenueCode.code),
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
    include: { ratePlan: true, guest: true, room: true },
  });
  if (!res) throw new Error('Reservation not found');
  const biz = await getCurrentBusinessDate();
  const effective = dateOnly(input.effectiveDate);

  await replaceSlicesFromDate({
    reservationId: input.reservationId,
    fromDate: effective,
    roomTypeId: input.roomTypeId,
    ratePlanId: input.ratePlanId,
    checkOutDate: res.checkOutDate,
  });

  const headerSlice = await resolveStaySliceForDate(input.reservationId, biz);
  const newPlan = await prisma.ratePlan.findUnique({ where: { id: input.ratePlanId } });
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
    const adj =
      (await prisma.revenueCode.findFirst({ where: { code: 'RATE_ADJ' } })) ??
      (await prisma.revenueCode.findFirst({ where: { code: 'ROOM' } }));
    if (adj) {
      const externalRef = rateAdjExternalRef(input.reservationId, isoDate(biz));
      const existing = await prisma.folioCharge.findUnique({ where: { externalRef } });
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
  }

  void dispatchStayProductChanged({
    reservationId: input.reservationId,
    programCode: newPlan?.medicalFlag ? newPlan.code : undefined,
    previousProgramCode: res.ratePlan.medicalFlag ? res.ratePlan.code : undefined,
    effectiveDate: isoDate(effective),
    roomTypeId: input.roomTypeId,
    ratePlanId: input.ratePlanId,
    globalPersonId: res.guest.globalPersonId ?? undefined,
    roomNumber: res.room?.roomNumber,
    checkInDate: res.checkInDate.toISOString(),
    checkOutDate: res.checkOutDate.toISOString(),
  }).catch((e) => console.error('Stay product event failed', e));

  return { ok: true, preview };
}
