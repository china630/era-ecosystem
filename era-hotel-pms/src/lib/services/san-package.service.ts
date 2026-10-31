import { prisma } from '@/lib/prisma';
import { decimalToNumber } from '@/lib/decimal';
import { postCharge } from '@/lib/services/folio.service';
import { requireRevenueCodeByRole } from '@/lib/revenue-code-token';
import { resolveStaySliceForDate } from '@/lib/services/stay-slice.service';
import { NightlyPriceMissingError } from '@/lib/pricing/own-nightly-price';
import { paxCodesForCompose } from '@/lib/services/nafta-package-compose.service';

function sameCalendarDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

export async function getRatePlanPackageLines(ratePlanId: string) {
  return prisma.ratePlanPackageLine.findMany({
    where: { ratePlanId },
    include: { revenueCode: true },
    orderBy: { sortOrder: 'asc' },
  });
}

export async function postNightlyPackageCharges(
  reservationId: string,
  businessDate: Date,
  audit?: { userId?: string | null; source?: 'user' | 'elektraweb' | 'night_audit' | 'system' },
): Promise<{ posted: number; skipped: boolean }> {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      ratePlan: { include: { packageLines: { include: { revenueCode: true } } } },
      dailyRates: true,
      folios: { include: { charges: { include: { revenueCode: true } } } },
    },
  });
  if (!reservation) return { posted: 0, skipped: true };

  const slice = await resolveStaySliceForDate(reservationId, businessDate);
  // Tonight's articles follow the card tariff. A stale slice plan must not skip the night.
  const ratePlan = reservation.ratePlan;
  const { postsStayAsPackage } = await import('@/lib/services/medical-package-resolve.service');
  if (!postsStayAsPackage(ratePlan) && !reservation.medicalPackageCode) {
    const anyPaxSku = await prisma.reservationGuest.findFirst({
      where: { reservationId, medicalPackageCode: { not: null } },
      select: { id: true },
    });
    if (!anyPaxSku) {
      return { posted: 0, skipped: true };
    }
  }

  let sellAmount: number;
  const pax = await prisma.reservationGuest.findMany({
    where: { reservationId },
    select: {
      medicalPackageCode: true,
      firstName: true,
      lastName: true,
      guestId: true,
    },
    orderBy: { sortOrder: 'asc' },
  });
  const sellRow = reservation.dailyRates.find((d) => sameCalendarDay(d.stayDate, businessDate));
  const packageCodes =
    pax.length > 0
      ? paxCodesForCompose(pax, null)
      : [reservation.medicalPackageCode].filter((c): c is string => Boolean(c));
  const roomTypeId = slice?.roomTypeId ?? reservation.roomTypeId;
  if (sellRow) {
    sellAmount = decimalToNumber(sellRow.amount);
  } else {
    const { ownerPackageNightlyBreakdown } = await import(
      '@/lib/services/nafta-package-compose-apply.service'
    );
    const breakdown = roomTypeId
      ? await ownerPackageNightlyBreakdown(businessDate, packageCodes, {
          roomTypeId,
          mealPlanId: reservation.mealPlanId,
        })
      : null;
    if (breakdown == null) {
      throw new NightlyPriceMissingError(reservation.id, ratePlan.code);
    }
    sellAmount = breakdown.total;
  }

  // One PKG night line (sell amount). Component splits stay off the guest folio.
  // Description stays date-free; posted night is keyed by businessDate + PKG code.
  const pkgCode = await requireRevenueCodeByRole('PKG');
  const description = 'Medical package';
  const alreadyPosted = reservation.folios.some((f) =>
    f.charges.some(
      (c) =>
        c.revenueCodeId === pkgCode.id && sameCalendarDay(c.businessDate, businessDate),
    ),
  );
  if (alreadyPosted) {
    return { posted: 0, skipped: false };
  }

  await postCharge({
    reservationId,
    revenueCodeId: pkgCode.id,
    amount: sellAmount,
    qty: 1,
    description,
    businessDate,
    audit,
  });

  return { posted: 1, skipped: false };
}

export async function isProcedureIncludedInPackage(
  reservationId: string,
  serviceId: string,
): Promise<boolean> {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: { ratePlanId: true, ratePlan: { select: { medicalFlag: true } } },
  });
  if (!reservation?.ratePlan.medicalFlag) return false;

  const inclusion = await prisma.ratePlanProcedureInclusion.findUnique({
    where: {
      ratePlanId_serviceId: { ratePlanId: reservation.ratePlanId, serviceId },
    },
  });
  return !!inclusion;
}
