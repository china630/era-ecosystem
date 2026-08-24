import { updateReservationSchedule } from '@/lib/services/reservation.service';
import { recordRoomMove } from '@/lib/services/room-occupancy-log.service';
import { physicalTypeAllowedForDoor } from '@/lib/services/door-type.policy';
import { prisma } from '@/lib/prisma';

const RELOCATABLE = ['CONFIRMED', 'IN_HOUSE', 'OPTION'] as const;

export async function relocateReservationRoom(
  reservationId: string,
  toRoomId: string,
  opts?: {
    reason?: string;
    reasonCode?: string;
    compUpgrade?: boolean;
    givenRoomTypeId?: string | null;
    actorUserId?: string;
  },
) {
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
  const allowed = physicalTypeAllowedForDoor({
    chargedRoomTypeId: reservation.roomTypeId,
    givenRoomTypeId: opts?.givenRoomTypeId ?? reservation.givenRoomTypeId,
    doorRoomTypeId: toRoom.roomTypeId,
    compUpgrade: Boolean(opts?.compUpgrade),
  });
  if (!allowed.ok) throw new Error(allowed.error);

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
  const updated = await updateReservationSchedule(reservationId, {
    roomId: toRoomId,
    allowCompUpgrade: Boolean(opts?.compUpgrade),
  });
  if (opts?.compUpgrade && toRoom.roomTypeId !== reservation.roomTypeId) {
    await prisma.reservation.update({
      where: { id: reservationId },
      data: { givenRoomTypeId: toRoom.roomTypeId },
    });
  }
  if (shareBedIndex != null) {
    await prisma.reservation.update({
      where: { id: reservationId },
      data: { shareBedIndex },
    });
  }

  if (fromRoomId && fromRoomId !== toRoomId) {
    await recordRoomMove({
      reservationId,
      fromRoomId,
      toRoomId,
      effectiveAt: new Date(),
      notes: opts?.reason ?? 'Quick move from room rack / plan',
      reasonCode: opts?.reasonCode,
      createdByUserId: opts?.actorUserId,
      kind: 'OCCURRED',
      status: 'APPLIED',
    });
    const { dispatchRoomChanged } = await import('@/lib/integration/guest-lifecycle-events');
    const dest = await prisma.room.findUnique({ where: { id: toRoomId } });
    const fromRoom = fromRoomId
      ? await prisma.room.findUnique({ where: { id: fromRoomId } })
      : null;
    void dispatchRoomChanged({
      reservationId,
      previousRoomNumber: fromRoom?.roomNumber ?? undefined,
      newRoomNumber: dest?.roomNumber ?? toRoomId,
      programCode: reservation.ratePlan?.medicalFlag ? reservation.ratePlan.code : undefined,
    }).catch((e) => console.error('Guest lifecycle room change failed', e));
  }

  return updated;
}
