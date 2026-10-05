/**
 * One-shot: stays that only have a header total get a night grid.
 * Does not replace an existing ReservationDailyRate row.
 * The Elektra night grid (QA_EASYPMS_RESDETAIL) overwrites these on the next card sync.
 */
import { PrismaClient } from '@prisma/client';
import { fillDailyRatesFromHeader } from '../../src/lib/integration/elektraweb-daily-rates';

async function main() {
  const prisma = new PrismaClient();
  const stays = await prisma.reservation.findMany({
    where: { totalAmount: { gt: 0 }, dailyRates: { none: {} } },
    select: {
      id: true,
      organizationId: true,
      checkInDate: true,
      checkOutDate: true,
      totalAmount: true,
    },
  });
  let filled = 0;
  for (const stay of stays) {
    await fillDailyRatesFromHeader(prisma, {
      reservationId: stay.id,
      organizationId: stay.organizationId,
      checkIn: stay.checkInDate,
      checkOut: stay.checkOutDate,
      nightly: null,
      total: Number(stay.totalAmount),
    });
    filled += 1;
  }
  console.log(`filled ${filled} of ${stays.length} stays that had a total and no night grid`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
