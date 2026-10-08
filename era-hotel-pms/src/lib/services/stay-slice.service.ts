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
    roomId: null,
    createdAt: new Date(),
  };
}

export async function replaceSlicesFromDate(input: {
  reservationId: string;
  fromDate: Date;
  roomTypeId: string;
  ratePlanId: string;
  checkOutDate: Date;
  roomId?: string | null;
  /** Door that stays on the segment before the split, when that slice has no room yet. */
  keepRoomId?: string | null;
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
        data: {
          toDate: from,
          ...(slice.roomId || !input.keepRoomId ? {} : { roomId: input.keepRoomId }),
        },
      });
    }
    await tx.reservationStaySlice.create({
      data: {
        reservationId: input.reservationId,
        fromDate: from,
        toDate: checkout,
        roomTypeId: input.roomTypeId,
        ratePlanId: input.ratePlanId,
        roomId: input.roomId ?? null,
      },
    });
  });
}

/** Second segment from `fromDate` until checkout. Holds a door when roomId is set, otherwise the type quota. */
export async function splitStayFromDate(input: {
  reservationId: string;
  fromDate: Date;
  roomTypeId: string;
  roomId?: string | null;
}) {
  const res = await prisma.reservation.findUnique({ where: { id: input.reservationId } });
  if (!res) throw new Error('Reservation not found');
  if (res.status !== 'CONFIRMED' && res.status !== 'OPTION' && res.status !== 'IN_HOUSE') {
    throw new Error('Stay cannot be split');
  }
  const from = dateOnlyUtc(input.fromDate);
  const checkIn = dateOnlyUtc(res.checkInDate);
  const checkOut = dateOnlyUtc(res.checkOutDate);
  if (from.getTime() <= checkIn.getTime() || from.getTime() >= checkOut.getTime()) {
    throw new Error('Split date must be inside the stay');
  }

  if (input.roomId) {
    const room = await prisma.room.findUnique({ where: { id: input.roomId } });
    if (!room) throw new Error('Room not found');
    if (room.roomTypeId !== input.roomTypeId) throw new Error('Room does not match room type');
    const { resolveDoorAssignment } = await import('@/lib/services/share-assignment.service');
    await resolveDoorAssignment({
      roomId: input.roomId,
      checkIn: from,
      checkOut,
      excludeReservationId: res.id,
      candidate: {
        shareEligible: false,
        shareGender: null,
        adults: res.adults,
      },
    });
  } else {
    const { getAvailability } = await import('@/lib/services/reservation.service');
    const avail = await getAvailability(input.roomTypeId, from, checkOut, res.id);
    if (avail.available < 1 || avail.stopSell) {
      throw new Error('No availability for that room type');
    }
  }

  await replaceSlicesFromDate({
    reservationId: res.id,
    fromDate: from,
    roomTypeId: input.roomTypeId,
    ratePlanId: res.ratePlanId,
    checkOutDate: checkOut,
    roomId: input.roomId ?? null,
    keepRoomId: res.roomId,
  });

  await prisma.roomChangePlan.create({
    data: {
      organizationId: res.organizationId,
      reservationId: res.id,
      fromRoomId: res.roomId,
      toRoomId: input.roomId ?? null,
      effectiveAt: from,
      kind: 'SCHEDULED',
      status: 'PENDING',
    },
  });
}

export { isoDate };
