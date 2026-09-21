import { prisma } from '@/lib/prisma';
import { recordRoomMove } from '@/lib/services/room-occupancy-log.service';
import { physicalTypeAllowedForDoor } from '@/lib/services/door-type.policy';
import { dispatchRoomChanged } from '@/lib/integration/guest-lifecycle-events';
import { REISSUE_KEY_TASK_TITLE } from '@/lib/services/depart-guest.service';
import { addReservationTask } from '@/lib/services/reservation-submodals.service';

const RELOCATABLE = ['CONFIRMED', 'IN_HOUSE', 'OPTION'] as const;

/**
 * Swap assigned doors between two sibling stays in the same booking group (ADR D5).
 * Does not rewrite folios or nightly rates.
 */
export async function swapReservationRooms(
  reservationIdA: string,
  reservationIdB: string,
  opts?: { actorUserId?: string },
) {
  if (reservationIdA === reservationIdB) throw new Error('Cannot swap a stay with itself');

  const [a, b] = await Promise.all([
    prisma.reservation.findUnique({
      where: { id: reservationIdA },
      include: { room: true, ratePlan: true },
    }),
    prisma.reservation.findUnique({
      where: { id: reservationIdB },
      include: { room: true, ratePlan: true },
    }),
  ]);
  if (!a || !b) throw new Error('Reservation not found');
  if (!a.groupId || a.groupId !== b.groupId) {
    const err = new Error('Swap rooms only within the same booking group');
    (err as Error & { status?: number }).status = 409;
    throw err;
  }
  if (!a.roomId || !b.roomId) {
    throw new Error('Both stays must have an assigned room to swap');
  }
  if (
    !RELOCATABLE.includes(a.status as (typeof RELOCATABLE)[number]) ||
    !RELOCATABLE.includes(b.status as (typeof RELOCATABLE)[number])
  ) {
    throw new Error('Swap only for CONFIRMED, IN_HOUSE, or OPTION stays');
  }

  const roomA = a.room!;
  const roomB = b.room!;

  const allowAtoB = physicalTypeAllowedForDoor({
    chargedRoomTypeId: a.roomTypeId,
    givenRoomTypeId: a.givenRoomTypeId,
    doorRoomTypeId: roomB.roomTypeId,
    compUpgrade: true,
  });
  if (!allowAtoB.ok) throw new Error(allowAtoB.error ?? 'Door type not allowed for stay A');
  const allowBtoA = physicalTypeAllowedForDoor({
    chargedRoomTypeId: b.roomTypeId,
    givenRoomTypeId: b.givenRoomTypeId,
    doorRoomTypeId: roomA.roomTypeId,
    compUpgrade: true,
  });
  if (!allowBtoA.ok) throw new Error(allowBtoA.error ?? 'Door type not allowed for stay B');

  const fromA = a.roomId;
  const fromB = b.roomId;

  await prisma.$transaction(async (tx) => {
    // Clear both doors first to avoid unique/overlap conflicts mid-swap
    await tx.reservation.update({ where: { id: a.id }, data: { roomId: null } });
    await tx.reservation.update({ where: { id: b.id }, data: { roomId: null } });
    await tx.reservation.update({
      where: { id: a.id },
      data: {
        roomId: fromB,
        givenRoomTypeId:
          roomB.roomTypeId !== a.roomTypeId ? roomB.roomTypeId : a.givenRoomTypeId,
      },
    });
    await tx.reservation.update({
      where: { id: b.id },
      data: {
        roomId: fromA,
        givenRoomTypeId:
          roomA.roomTypeId !== b.roomTypeId ? roomA.roomTypeId : b.givenRoomTypeId,
      },
    });
  });

  await recordRoomMove({
    reservationId: a.id,
    fromRoomId: fromA,
    toRoomId: fromB,
    effectiveAt: new Date(),
    notes: 'Swap rooms',
    reasonCode: 'SWAP',
    createdByUserId: opts?.actorUserId,
    kind: 'OCCURRED',
    status: 'APPLIED',
  });
  await recordRoomMove({
    reservationId: b.id,
    fromRoomId: fromB,
    toRoomId: fromA,
    effectiveAt: new Date(),
    notes: 'Swap rooms',
    reasonCode: 'SWAP',
    createdByUserId: opts?.actorUserId,
    kind: 'OCCURRED',
    status: 'APPLIED',
  });

  void dispatchRoomChanged({
    reservationId: a.id,
    previousRoomNumber: roomA.roomNumber,
    newRoomNumber: roomB.roomNumber,
    programCode: a.ratePlan?.medicalFlag ? a.ratePlan.code : undefined,
  }).catch(() => undefined);
  void dispatchRoomChanged({
    reservationId: b.id,
    previousRoomNumber: roomB.roomNumber,
    newRoomNumber: roomA.roomNumber,
    programCode: b.ratePlan?.medicalFlag ? b.ratePlan.code : undefined,
  }).catch(() => undefined);

  await Promise.all([
    addReservationTask(a.id, { title: REISSUE_KEY_TASK_TITLE }).catch(() => undefined),
    addReservationTask(b.id, { title: REISSUE_KEY_TASK_TITLE }).catch(() => undefined),
  ]);

  return {
    a: { id: a.id, roomId: fromB, roomNumber: roomB.roomNumber },
    b: { id: b.id, roomId: fromA, roomNumber: roomA.roomNumber },
  };
}
