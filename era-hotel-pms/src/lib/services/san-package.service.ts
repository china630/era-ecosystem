import { prisma } from '@/lib/prisma';
import { decimalToNumber } from '@/lib/decimal';
import { postCharge } from '@/lib/services/folio.service';
import { findRevenueCodeByToken } from '@/lib/revenue-code-token';
import { scaleLinesToSell } from '@/lib/services/door-type.policy';
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
  const ratePlanId = slice?.ratePlanId ?? reservation.ratePlanId;
  const ratePlan =
    ratePlanId === reservation.ratePlanId
      ? reservation.ratePlan
      : await prisma.ratePlan.findUnique({
          where: { id: ratePlanId },
          include: { packageLines: { include: { revenueCode: true } } },
        });
  if (!ratePlan?.medicalFlag && !reservation.medicalPackageCode) {
    const anyPaxSku = await prisma.reservationGuest.findFirst({
      where: { reservationId, medicalPackageCode: { not: null } },
      select: { id: true },
    });
    if (!anyPaxSku) {
      return { posted: 0, skipped: true };
    }
  }
  if (!ratePlan) {
    return { posted: 0, skipped: true };
  }

  const lines = ratePlan.packageLines;
  const pkgCode = await findRevenueCodeByToken('PKG');

  let sellAmount: number;
  let mainSkuCode: string | null = null;
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
  const stayCode = ratePlan.code ?? reservation.medicalPackageCode;
  const packageCodes =
    pax.length > 0
      ? paxCodesForCompose(pax, stayCode)
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
    mainSkuCode = breakdown.lines.find((l) => l.role === 'main')?.code ?? null;
  }
  if (sellRow && packageCodes.length > 0 && roomTypeId) {
    const { ownerPackageNightlyBreakdown } = await import(
      '@/lib/services/nafta-package-compose-apply.service'
    );
    const breakdown = await ownerPackageNightlyBreakdown(businessDate, packageCodes, {
      roomTypeId,
      mealPlanId: reservation.mealPlanId,
    });
    mainSkuCode = breakdown?.lines.find((l) => l.role === 'main')?.code ?? ratePlan.code;
  }

  let packageLines = lines;
  if (mainSkuCode) {
    const mainPlan = await prisma.ratePlan.findFirst({
      where: { code: mainSkuCode },
      include: { packageLines: { include: { revenueCode: true } } },
    });
    if (mainPlan?.packageLines?.length) {
      packageLines = mainPlan.packageLines;
    }
  }

  const rawLines =
    packageLines.length > 0
      ? packageLines.map((l) => ({
          revenueCodeId: l.revenueCodeId,
          code: l.revenueCode.code,
          amount: decimalToNumber(l.amount),
          description: `Package ${l.revenueCode.name} ${businessDate.toISOString().slice(0, 10)}`,
        }))
      : pkgCode
        ? [
            {
              revenueCodeId: pkgCode.id,
              code: 'PKG',
              amount: decimalToNumber(ratePlan.pricePerNight),
              description: `Medical package ${businessDate.toISOString().slice(0, 10)}`,
            },
          ]
        : [];

  const scaled = scaleLinesToSell(rawLines, sellAmount);
  const chargeLines = rawLines.map((line, i) => ({ ...line, amount: scaled[i] ?? line.amount }));

  if (chargeLines.length === 0) {
    return { posted: 0, skipped: true };
  }

  let posted = 0;
  for (const line of chargeLines) {
    const alreadyPosted = reservation.folios.some((f) =>
      f.charges.some(
        (c) =>
          c.revenueCodeId === line.revenueCodeId &&
          sameCalendarDay(c.businessDate, businessDate) &&
          c.description.includes(businessDate.toISOString().slice(0, 10)),
      ),
    );
    if (alreadyPosted) continue;

    await postCharge({
      reservationId,
      revenueCodeId: line.revenueCodeId,
      amount: line.amount,
      qty: 1,
      description: line.description,
      businessDate,
    });
    posted += 1;
  }

  return { posted, skipped: posted === 0 };
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
