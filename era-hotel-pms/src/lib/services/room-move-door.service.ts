import { todayBakuYmd } from '@era/satellite-kit/time';
import { prisma } from '@/lib/prisma';
import { hotelDateKey } from '@/lib/hotel-calendar';
import { roomWriteFromAxes } from '@/lib/room-state';
import { countRemainingInHouseOnDoor } from '@/lib/services/share-assignment.service';

/** Reasons the move confirmation offers. Free text is not a reason. */
export const ROOM_MOVE_REASONS = ['GUEST_REFUSED', 'DID_NOT_OCCUPY', 'HOTEL'] as const;
export type RoomMoveReason = (typeof ROOM_MOVE_REASONS)[number];

export function isRoomMoveReason(value: string | null | undefined): value is RoomMoveReason {
  return ROOM_MOVE_REASONS.includes(value as RoomMoveReason);
}

/**
 * "Did not occupy" keeps the vacated door clean only when the guest has not
 * stayed a hotel night and the folio has no charges. Any other case is Dirty.
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
  const today = todayBakuYmd();
  if (hotelDateKey(row.checkInDate) < today) return false;
  if (row.stay?.actualCheckIn && hotelDateKey(row.stay.actualCheckIn) < today) return false;
  const charges = await prisma.folioCharge.count({
    where: { folio: { reservationId } },
  });
  return charges === 0;
}

/**
 * After an in-house guest leaves a door for another one, the old door becomes
 * Dirty with a housekeeping task. Share roommates still in house keep the door.
 * DID_NOT_OCCUPY skips that only when `didNotOccupyKeepsClean` is true.
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

  const others = await countRemainingInHouseOnDoor(fromRoomId, input.reservationId);
  if (others > 0) return;

  if (
    input.reasonCode === 'DID_NOT_OCCUPY' &&
    (await didNotOccupyKeepsClean(input.reservationId))
  ) {
    return;
  }

  await prisma.room.update({
    where: { id: fromRoomId },
    data: roomWriteFromAxes('DIRTY', 'IN_SERVICE'),
  });
  await prisma.housekeepingTask.create({
    data: {
      roomId: fromRoomId,
      status: 'PENDING',
      notes: 'In-house room move',
      jobType: 'DEPARTURE',
    },
  });
}
