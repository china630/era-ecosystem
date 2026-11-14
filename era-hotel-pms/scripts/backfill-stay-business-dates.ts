/**
 * Re-apply Stay checkIn/checkOut business-date heuristic (Asia/Baku civil of actual*).
 * Migration already backfills on apply; use this for dry-run review or repair.
 *
 *   npx tsx scripts/backfill-stay-business-dates.ts
 *   npx tsx scripts/backfill-stay-business-dates.ts --apply
 */
import { PrismaClient } from '@prisma/client';
import { bakuCivilUtcDate, bakuDateKey } from '@era/satellite-kit/time';

const apply = process.argv.includes('--apply');
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.stay.findMany({
    select: {
      id: true,
      actualCheckIn: true,
      actualCheckOut: true,
      checkInBusinessDate: true,
      checkOutBusinessDate: true,
      reservation: { select: { id: true } },
    },
  });

  let wouldUpdate = 0;
  for (const row of rows) {
    const nextIn = bakuCivilUtcDate(bakuDateKey(row.actualCheckIn));
    const nextOut = row.actualCheckOut
      ? bakuCivilUtcDate(bakuDateKey(row.actualCheckOut))
      : null;
    const inDiff = nextIn.getTime() !== row.checkInBusinessDate.getTime();
    const outDiff =
      (nextOut?.getTime() ?? null) !== (row.checkOutBusinessDate?.getTime() ?? null);
    if (!inDiff && !outDiff) continue;
    wouldUpdate += 1;
    console.log(
      JSON.stringify({
        stayId: row.id,
        reservationId: row.reservation.id,
        actualCheckIn: row.actualCheckIn.toISOString(),
        checkInBusinessDate: row.checkInBusinessDate.toISOString().slice(0, 10),
        nextCheckInBusinessDate: nextIn.toISOString().slice(0, 10),
        actualCheckOut: row.actualCheckOut?.toISOString() ?? null,
        checkOutBusinessDate: row.checkOutBusinessDate?.toISOString().slice(0, 10) ?? null,
        nextCheckOutBusinessDate: nextOut?.toISOString().slice(0, 10) ?? null,
      }),
    );
    if (apply) {
      await prisma.stay.update({
        where: { id: row.id },
        data: {
          checkInBusinessDate: nextIn,
          checkOutBusinessDate: nextOut,
        },
      });
    }
  }

  console.log(
    apply
      ? `Applied updates: ${wouldUpdate}`
      : `Dry-run: ${wouldUpdate} stay(s) would change. Pass --apply to write.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
