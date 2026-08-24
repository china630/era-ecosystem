import { prisma } from '@/lib/prisma';
import { dateOnlyUtc, isoDate } from '@/lib/services/door-type.policy';

export async function resolveStaySliceForDate(reservationId: string, stayDate: Date) {
  const day = dateOnlyUtc(stayDate);
  const slices = await prisma.reservationStaySlice.findMany({
    where: { reservationId },
    orderBy: { fromDate: 'asc' },
  });
  const hit = slices.find((s) => dateOnlyUtc(s.fromDate) <= day && day < dateOnlyUtc(s.toDate));
  if (hit) return hit;
  const res = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: { roomTypeId: true, ratePlanId: true, checkInDate: true, checkOutDate: true },
  });
  if (!res) return null;
  return {
    id: '',
    reservationId,
    fromDate: res.checkInDate,
    toDate: res.checkOutDate,
    roomTypeId: res.roomTypeId,
    ratePlanId: res.ratePlanId,
    createdAt: new Date(),
  };
}

export async function replaceSlicesFromDate(input: {
  reservationId: string;
  fromDate: Date;
  roomTypeId: string;
  ratePlanId: string;
  checkOutDate: Date;
}) {
  const from = dateOnlyUtc(input.fromDate);
  const checkout = dateOnlyUtc(input.checkOutDate);
  const existing = await prisma.reservationStaySlice.findMany({
    where: { reservationId: input.reservationId },
    orderBy: { fromDate: 'asc' },
  });

  await prisma.$transaction(async (tx) => {
    for (const slice of existing) {
      const sFrom = dateOnlyUtc(slice.fromDate);
      const sTo = dateOnlyUtc(slice.toDate);
      if (sTo <= from) continue;
      if (sFrom >= from) {
        await tx.reservationStaySlice.delete({ where: { id: slice.id } });
        continue;
      }
      await tx.reservationStaySlice.update({
        where: { id: slice.id },
        data: { toDate: from },
      });
    }
    await tx.reservationStaySlice.create({
      data: {
        reservationId: input.reservationId,
        fromDate: from,
        toDate: checkout,
        roomTypeId: input.roomTypeId,
        ratePlanId: input.ratePlanId,
      },
    });
  });
}

export { isoDate };
