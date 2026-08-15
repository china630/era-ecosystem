import { prisma } from '@/lib/prisma';
import { decimalToNumber } from '@/lib/decimal';
import { getHotelPolicy } from '@/lib/services/hotel-policy.service';

/**
 * Highest matching active YieldRule adjustment for current occupancy %.
 * Returns 0 when load-based pricing is disabled or no rule matches.
 */
export async function resolveLoadBasedAdjustmentPercent(
  occupancyPct: number,
  propertyCode?: string,
): Promise<number> {
  const policy = await getHotelPolicy();
  if (!policy.loadBasedPricingEnabled) return 0;

  const rules = await prisma.yieldRule.findMany({
    where: { active: true },
    orderBy: { minOccupancyPct: 'desc' },
  });

  const code = propertyCode?.trim();
  const scoped = code
    ? rules.filter((r) => r.propertyCode === code || r.propertyCode === 'DEFAULT')
    : rules;

  for (const rule of scoped) {
    if (occupancyPct >= decimalToNumber(rule.minOccupancyPct)) {
      return decimalToNumber(rule.rateAdjustment);
    }
  }
  return 0;
}

/** Rough in-house occupancy % for a calendar night (inventory rooms). */
export async function estimateOccupancyPctForNight(night: Date): Promise<number> {
  const dayStart = new Date(night);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const [sold, capacity] = await Promise.all([
    prisma.reservation.count({
      where: {
        status: { in: ['CONFIRMED', 'IN_HOUSE'] },
        checkInDate: { lt: dayEnd },
        checkOutDate: { gt: dayStart },
      },
    }),
    prisma.room.count({ where: { disabled: false, deleted: false } }),
  ]);

  if (capacity <= 0) return 0;
  return Math.min(100, Math.round((sold / capacity) * 10000) / 100);
}
