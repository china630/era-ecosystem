import { prisma } from '@/lib/prisma';
import { decimalToNumber } from '@/lib/decimal';
import { recommendedBoardAddOns } from '@/lib/services/pricing-components.service';
import { currentSellVersion } from '@/lib/services/rate-plan-sell-versions.service';

/**
 * Phase A unit-economics snapshot (proxy CPOR from configured COGS).
 * Finance-allocated CPOR arrives later — UI must show estimate badge.
 */
export async function getUnitEconomicsSnapshot() {
  const recommended = await recommendedBoardAddOns();
  const packages = await prisma.ratePlan.findMany({
    where: { medicalFlag: true, active: true },
    orderBy: { code: 'asc' },
    select: {
      id: true,
      code: true,
      name: true,
      pricePerNight: true,
    },
  });

  const packageRows = [];
  for (const pkg of packages) {
    const v1 = await currentSellVersion(pkg.id, 1);
    const v2 = await currentSellVersion(pkg.id, 2);
    const sell1 = v1 ? decimalToNumber(v1.sellPrice) : decimalToNumber(pkg.pricePerNight);
    const floor1 = v1?.costFloor != null ? decimalToNumber(v1.costFloor) : null;
    packageRows.push({
      code: pkg.code,
      name: pkg.name,
      sell1,
      floor1,
      belowFloor: floor1 != null && sell1 < floor1,
      sell2: v2 ? decimalToNumber(v2.sellPrice) : null,
      floor2: v2?.costFloor != null ? decimalToNumber(v2.costFloor) : null,
    });
  }

  const food = recommended.foodCogsDay ?? 0;
  const medical = recommended.medicalCogs ?? 0;
  const serviceFee = recommended.serviceFee;
  const proxyCporPerPersonNight = Math.round((food / 3 + medical + serviceFee) * 100) / 100;

  return {
    estimate: true as const,
    recommended,
    proxyCporPerPersonNight,
    extraAdultBb: recommended.extraAdultBb,
    extraAdultFb: recommended.extraAdultFb,
    packages: packageRows,
    belowFloorCount: packageRows.filter((p) => p.belowFloor).length,
  };
}
