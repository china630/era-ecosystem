import { prisma } from '@/lib/prisma';

/** FO rack / RoomInfo / PATCH rooms status cannot flip cleanliness on a live stay. */
export class OccupiedHkLockedError extends Error {
  status = 409;
  code = 'OCCUPIED_HK_LOCKED' as const;
  constructor() {
    super('Cannot change housekeeping condition while the room is in-house');
    this.name = 'OccupiedHkLockedError';
  }
}

export async function roomHasInHouseStay(roomId: string): Promise<boolean> {
  const stay = await prisma.reservation.findFirst({
    where: { roomId, status: 'IN_HOUSE' },
    select: { id: true },
  });
  return Boolean(stay);
}

export async function assertRoomHkEditable(roomId: string): Promise<void> {
  if (await roomHasInHouseStay(roomId)) {
    throw new OccupiedHkLockedError();
  }
}

export function stayListHasInHouse(
  reservations: Array<{ status?: string | null }> | null | undefined,
): boolean {
  return (reservations ?? []).some((row) => row.status === 'IN_HOUSE');
}
