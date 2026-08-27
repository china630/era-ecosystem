import { prisma } from '@/lib/prisma';
import { decimalToNumber } from '@/lib/decimal';
import { postCharge } from '@/lib/services/folio.service';
import { scaleLinesToSell } from '@/lib/services/door-type.policy';
import { resolveStaySliceForDate } from '@/lib/services/stay-slice.service';

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
  if (!ratePlan?.medicalFlag) {
    return { posted: 0, skipped: true };
  }

  const lines = ratePlan.packageLines;
  const pkgCode = await prisma.revenueCode.findFirst({ where: { code: 'PKG' } });
  const sellRow = reservation.dailyRates.find((d) => sameCalendarDay(d.stayDate, businessDate));
  const sellAmount = sellRow
    ? decimalToNumber(sellRow.amount)
    : decimalToNumber(ratePlan.pricePerNight);

  const rawLines =
    lines.length > 0
      ? lines.map((l) => ({
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
