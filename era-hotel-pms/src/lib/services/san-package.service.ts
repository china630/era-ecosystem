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
  const pkgCode = await prisma.revenueCode.findFirst({ where: { code: 'PKG' } });

  // Wave D: prefer composed sell from pax medicalPackageCode when daily rate missing
  let sellAmount: number;
  let mainSkuCode: string | null = null;
  const pax = await prisma.reservationGuest.findMany({
    where: { reservationId },
    select: { medicalPackageCode: true },
    orderBy: { sortOrder: 'asc' },
  });
  const sellRow = reservation.dailyRates.find((d) => sameCalendarDay(d.stayDate, businessDate));
  if (sellRow) {
    sellAmount = decimalToNumber(sellRow.amount);
  } else {
    const { composeNaftaPackageNightlySell } = await import(
      '@/lib/services/nafta-package-compose.service'
    );
    const { resolveStandartCompanionAzn, loadNaftaPackageSellCatalog } = await import(
      '@/lib/services/nafta-package-compose-apply.service'
    );
    const companion = await resolveStandartCompanionAzn(businessDate);
    const catalog = await loadNaftaPackageSellCatalog(businessDate);
    const composed = composeNaftaPackageNightlySell(
      [...pax.map((g) => g.medicalPackageCode), reservation.medicalPackageCode],
      catalog,
      companion,
    );
    sellAmount =
      composed ?? decimalToNumber(ratePlan.pricePerNight);
  }

  // Pilot polish P1.3: package line split from **main** (highest occ-1) SKU rate plan
  {
    const { loadNaftaPackageSellCatalog } = await import(
      '@/lib/services/nafta-package-compose-apply.service'
    );
    const { composeNaftaPackageNightlySellBreakdown } = await import(
      '@/lib/services/nafta-package-compose.service'
    );
    const catalog = await loadNaftaPackageSellCatalog(businessDate);
    const breakdown = composeNaftaPackageNightlySellBreakdown(
      [...pax.map((g) => g.medicalPackageCode), reservation.medicalPackageCode],
      catalog,
    );
    mainSkuCode = breakdown?.lines.find((l) => l.role === 'main')?.code ?? null;
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
