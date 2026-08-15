import { prisma } from '@/lib/prisma';
import { toDecimal } from '@/lib/decimal';
import { recordHotelAudit } from '@/lib/satellite-audit';

export async function listRatePlanSellVersions(ratePlanId: string) {
  return prisma.ratePlanSellVersion.findMany({
    where: { ratePlanId },
    orderBy: [{ occupancy: 'asc' }, { effectiveFrom: 'desc' }],
  });
}

export async function addRatePlanSellVersion(input: {
  ratePlanId: string;
  sellPrice: number;
  costFloor?: number | null;
  occupancy?: number;
  effectiveFrom: Date;
  note?: string | null;
  createdById?: string | null;
}) {
  const occupancy = input.occupancy ?? 1;
  const plan = await prisma.ratePlan.findUnique({ where: { id: input.ratePlanId } });
  if (!plan) throw new Error('Rate plan not found');

  const created = await prisma.$transaction(async (tx) => {
    await tx.ratePlanSellVersion.updateMany({
      where: {
        ratePlanId: input.ratePlanId,
        occupancy,
        effectiveTo: null,
        effectiveFrom: { lt: input.effectiveFrom },
      },
      data: { effectiveTo: input.effectiveFrom },
    });

    const row = await tx.ratePlanSellVersion.create({
      data: {
        ratePlanId: input.ratePlanId,
        sellPrice: toDecimal(input.sellPrice),
        costFloor:
          input.costFloor == null ? null : toDecimal(input.costFloor),
        occupancy,
        effectiveFrom: input.effectiveFrom,
        note: input.note ?? null,
        createdById: input.createdById ?? null,
      },
    });

    // Keep legacy flat field in sync with current 1-adult sell when applicable
    if (occupancy === 1) {
      await tx.ratePlan.update({
        where: { id: input.ratePlanId },
        data: { pricePerNight: toDecimal(input.sellPrice) },
      });
    }

    return row;
  });

  await recordHotelAudit(
    { userId: input.createdById },
    'RatePlanSellVersion',
    created.id,
    'CREATE',
    {
      ratePlanId: input.ratePlanId,
      sellPrice: input.sellPrice,
      costFloor: input.costFloor ?? null,
      occupancy,
    },
  );

  return created;
}

export async function currentSellVersion(
  ratePlanId: string,
  occupancy: number,
  at: Date = new Date(),
) {
  return prisma.ratePlanSellVersion.findFirst({
    where: {
      ratePlanId,
      occupancy,
      effectiveFrom: { lte: at },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
    },
    orderBy: { effectiveFrom: 'desc' },
  });
}
