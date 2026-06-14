/**
 * Seed BAR plan + RoomTypeRate from legacy pricePerNight for Nafta go-live window.
 * Usage: npx tsx prisma/scripts/seed-bar-from-legacy.ts [--from=2026-06-01] [--to=2026-12-31]
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { ensureBarBasePlan } from '../../src/lib/pricing/bar-bootstrap.service';

const prisma = new PrismaClient();

function parseArg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.split('=')[1] ?? fallback;
}

async function main() {
  const fromStr = parseArg('from', '2026-06-01');
  const toStr = parseArg('to', '2026-12-31');
  const from = new Date(fromStr);
  const to = new Date(toStr);

  let bar = await prisma.ratePlan.findFirst({ where: { code: 'BAR', type: 'BASE' } });
  if (!bar) {
    const boot = await ensureBarBasePlan(prisma);
    bar = await prisma.ratePlan.findUnique({ where: { id: boot.ratePlanId } });
    if (bar) console.log('Created BAR base plan', bar.id);
  } else if (bar.type !== 'BASE') {
    bar = await prisma.ratePlan.update({
      where: { id: bar.id },
      data: { type: 'BASE' },
    });
  }

  if (!bar) {
    throw new Error('BAR base plan missing after bootstrap');
  }

  const roomTypes = await prisma.roomType.findMany({ where: { active: true } });
  const legacyPlans = await prisma.ratePlan.findMany({
    where: { active: true, medicalFlag: false },
    include: { roomType: true },
  });

  let upserted = 0;
  const cursor = new Date(from);
  while (cursor <= to) {
    for (const rt of roomTypes) {
      const legacy =
        legacyPlans.find((p) => p.roomTypeId === rt.id) ??
        legacyPlans.find((p) => !p.roomTypeId);
      const amount = legacy?.pricePerNight ?? new Prisma.Decimal(120);
      await prisma.roomTypeRate.upsert({
        where: {
          ratePlanId_roomTypeId_date: {
            ratePlanId: bar.id,
            roomTypeId: rt.id,
            date: new Date(cursor),
          },
        },
        create: {
          ratePlanId: bar.id,
          roomTypeId: rt.id,
          date: new Date(cursor),
          amount,
          currencyCode: 'AZN',
        },
        update: { amount },
      });
      upserted += 1;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  console.log(`BAR seed complete: ${upserted} room-type-rate cells (${fromStr}..${toStr})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
