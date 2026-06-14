import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type BarBootstrapResult = {
  ratePlanId: string;
  created: boolean;
};

/** Ensure exactly one BASE BAR rate plan exists (greenfield / import step 21a). */
export async function ensureBarBasePlan(
  tx: Pick<typeof prisma, 'ratePlan'> = prisma,
): Promise<BarBootstrapResult> {
  const existing = await tx.ratePlan.findFirst({
    where: { code: 'BAR' },
  });

  if (existing) {
    if (existing.type !== 'BASE' || !existing.active) {
      const updated = await tx.ratePlan.update({
        where: { id: existing.id },
        data: { type: 'BASE', active: true, name: existing.name || 'Best Available Rate' },
      });
      return { ratePlanId: updated.id, created: false };
    }
    return { ratePlanId: existing.id, created: false };
  }

  const created = await tx.ratePlan.create({
    data: {
      code: 'BAR',
      name: 'Best Available Rate',
      type: 'BASE',
      pricePerNight: new Prisma.Decimal(0),
      active: true,
    },
  });
  return { ratePlanId: created.id, created: true };
}
