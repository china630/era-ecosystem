import { prisma } from '@/lib/prisma';
import { hotelDateKey } from '@/lib/hotel-calendar';
import { countRemainingInHouseOnDoor } from '@/lib/services/share-assignment.service';

/** Reasons the move confirmation offers. Free text is not a reason. */
export const ROOM_MOVE_REASONS = ['GUEST_REFUSED', 'DID_NOT_OCCUPY', 'HOTEL'] as const;
export type RoomMoveReason = (typeof ROOM_MOVE_REASONS)[number];

export function isRoomMoveReason(value: string | null | undefined): value is RoomMoveReason {
  return ROOM_MOVE_REASONS.includes(value as RoomMoveReason);
}

/**
 * Hotel business day of arrival, check-in not on an earlier day, folio still empty.
 * That is the same moment as check-in: a reasoned move puts the old door back to Clean.
 */
export async function didNotOccupyKeepsClean(reservationId: string): Promise<boolean> {
  const row = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: {
      checkInDate: true,
      stay: { select: { actualCheckIn: true } },
    },
  });
  if (!row) return false;
  const { getCurrentBusinessDate } = await import('@/lib/services/business-date.service');
  const today = hotelDateKey(await getCurrentBusinessDate());
  if (hotelDateKey(row.checkInDate) < today) return false;
  if (row.stay?.actualCheckIn && hotelDateKey(row.stay.actualCheckIn) < today) return false;
  const charges = await prisma.folioCharge.count({
    where: { folio: { reservationId } },
  });
  return charges === 0;
}

/**
 * After an in-house guest leaves a door, the door they walk into is Dirty.
 * Share roommates still in the old door keep it.
 * A move with a reception reason on the arrival day, before any folio charge,
 * puts the vacated door back to Clean: check-in has just marked it Dirty and
 * the guest did not stay. Any later move leaves that door Dirty and opens a task.
 */
export async function settleVacatedDoorAfterMove(input: {
  reservationId: string;
  fromRoomId: string | null | undefined;
  toRoomId: string;
  status: string;
  reasonCode?: string | null;
}) {
  const fromRoomId = input.fromRoomId;
  if (!fromRoomId || fromRoomId === input.toRoomId) return;
  if (input.status !== 'IN_HOUSE') return;

  const { writeInServiceDoorHk } = await import('@/lib/services/room.service');
  await writeInServiceDoorHk(input.toRoomId, 'DIRTY');

  const others = await countRemainingInHouseOnDoor(fromRoomId, input.reservationId);
  if (others > 0) return;

  const sameMoment =
    isRoomMoveReason(input.reasonCode) && (await didNotOccupyKeepsClean(input.reservationId));
  if (sameMoment) {
    await writeInServiceDoorHk(fromRoomId, 'CLEAN');
    return;
  }

  await writeInServiceDoorHk(fromRoomId, 'DIRTY');
  await prisma.housekeepingTask.create({
    data: {
      roomId: fromRoomId,
      status: 'PENDING',
      notes: 'In-house room move',
      jobType: 'DEPARTURE',
    },
  });
}
