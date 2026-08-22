import { updateReservationSchedule } from '@/lib/services/reservation.service';
import { createRoomChangePlan } from '@/lib/services/reports.service';
import { prisma } from '@/lib/prisma';

const RELOCATABLE = ['CONFIRMED', 'IN_HOUSE', 'OPTION'] as const;

export async function relocateReservationRoom(reservationId: string, toRoomId: string) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { room: true, ratePlan: true },
  });
  if (!reservation) throw new Error('Reservation not found');
  if (!RELOCATABLE.includes(reservation.status as (typeof RELOCATABLE)[number])) {
    throw new Error('Room move only for CONFIRMED, IN_HOUSE, or OPTION');
  }

  const toRoom = await prisma.room.findUnique({ where: { id: toRoomId } });
  if (!toRoom) throw new Error('Room not found');
  if (toRoom.roomTypeId !== reservation.roomTypeId) {
    throw new Error('Room type mismatch');
  }
  const { assertRoomShareAssignable, roomStatusAllowedForShareAssign } = await import(
    '@/lib/services/share-assignment.service'
  );
  const { shareBedIndex, joiningPool } = await assertRoomShareAssignable({
    roomId: toRoomId,
    checkIn: reservation.checkInDate,
    checkOut: reservation.checkOutDate,
    excludeReservationId: reservationId,
    candidate: {
      shareEligible: reservation.shareEligible,
      shareGender: reservation.shareGender,
      adults: reservation.adults,
    },
  });
  if (!roomStatusAllowedForShareAssign(toRoom, joiningPool)) {
    throw new Error('Target room must be AVAILABLE, CLEAN, or INSPECTED (HK-03)');
  }

  const fromRoomId = reservation.roomId;
  const updated = await updateReservationSchedule(reservationId, { roomId: toRoomId });
  if (shareBedIndex != null) {
    await prisma.reservation.update({
      where: { id: reservationId },
      data: { shareBedIndex },
    });
  }

  if (fromRoomId && fromRoomId !== toRoomId) {
    await createRoomChangePlan({
      reservationId,
      fromRoomId,
      toRoomId,
      effectiveAt: new Date(),
      notes: 'Quick move from room rack / plan',
    });
    const { dispatchRoomChanged } = await import(
      '@/lib/integration/guest-lifecycle-events'
    );
    const toRoom = await prisma.room.findUnique({ where: { id: toRoomId } });
    const fromRoom = fromRoomId
      ? await prisma.room.findUnique({ where: { id: fromRoomId } })
      : null;
    void dispatchRoomChanged({
      reservationId,
      previousRoomNumber: fromRoom?.roomNumber ?? undefined,
      newRoomNumber: toRoom?.roomNumber ?? toRoomId,
      programCode:
        reservation.ratePlan?.medicalFlag ? reservation.ratePlan.code : undefined,
    }).catch((e) => console.error('Guest lifecycle room change failed', e));
  }

  return updated;
}
