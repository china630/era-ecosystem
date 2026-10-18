import { prisma } from '@/lib/prisma';

export async function roomHasInHouseStay(roomId: string): Promise<boolean> {
  const stay = await prisma.reservation.findFirst({
    where: { roomId, status: 'IN_HOUSE' },
    select: { id: true },
  });
  return Boolean(stay);
}
