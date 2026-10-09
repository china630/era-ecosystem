import { prisma } from '@/lib/prisma';
import { toDecimal } from '@/lib/decimal';
import { recordHotelAudit } from '@/lib/satellite-audit';

export async function listRatePlanSellVersions(ratePlanId: string) {
  return prisma.ratePlanSellVersion.findMany({
    where: { ratePlanId, roomTypeId: { not: null } },
    include: {
      roomType: { select: { id: true, code: true, adultCapacity: true } },
      mealPlan: { select: { id: true, code: true } },
    },
    orderBy: [{ occupancy: 'asc' }, { effectiveFrom: 'desc' }],
  });
}

export async function addRatePlanSellVersion(input: {
  ratePlanId: string;
  roomTypeId: string;
  mealPlanId: string;
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
  const roomType = await prisma.roomType.findUnique({ where: { id: input.roomTypeId } });
  if (!roomType) throw new Error('Room type not found');
  if (occupancy > roomType.adultCapacity) {
    throw new Error(`Occupancy ${occupancy} is above ${roomType.code} ceiling ${roomType.adultCapacity}`);
  }
  const meal = await prisma.mealPlan.findUnique({ where: { id: input.mealPlanId } });
  if (!meal) throw new Error('Meal plan not found');

  const created = await prisma.$transaction(async (tx) => {
    await tx.ratePlanSellVersion.updateMany({
      where: {
        ratePlanId: input.ratePlanId,
        roomTypeId: input.roomTypeId,
        mealPlanId: input.mealPlanId,
        occupancy,
        effectiveTo: null,
        effectiveFrom: { lt: input.effectiveFrom },
      },
      data: { effectiveTo: input.effectiveFrom },
    });

    return tx.ratePlanSellVersion.create({
      data: {
        ratePlanId: input.ratePlanId,
        roomTypeId: input.roomTypeId,
        mealPlanId: input.mealPlanId,
        sellPrice: toDecimal(input.sellPrice),
        costFloor:
          input.costFloor == null ? null : toDecimal(input.costFloor),
        occupancy,
        effectiveFrom: input.effectiveFrom,
        note: input.note ?? null,
        createdById: input.createdById ?? null,
      },
    });
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
      roomTypeId: input.roomTypeId,
      mealPlanId: input.mealPlanId,
    },
  );

  return created;
}

export async function currentSellVersion(
  ratePlanId: string,
  occupancy: number,
  at: Date = new Date(),
  roomTypeId?: string,
) {
  return prisma.ratePlanSellVersion.findFirst({
    where: {
      ratePlanId,
      occupancy,
      roomTypeId: roomTypeId ?? { not: null },
      effectiveFrom: { lte: at },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
    },
    orderBy: { effectiveFrom: 'desc' },
  });
}
