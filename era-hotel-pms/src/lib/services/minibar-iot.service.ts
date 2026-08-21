import { prisma } from '@/lib/prisma';
import { postMinibar } from '@/lib/services/wave-b-master.service';

export type MinibarSensorPayload = {
  roomNumber: string;
  sensorId?: string;
  itemCode: string;
  deltaQty?: number;
  raw?: Record<string, unknown>;
};

export async function ingestMinibarSensorEvent(payload: MinibarSensorPayload) {
  const room = await prisma.room.findFirst({ where: { roomNumber: payload.roomNumber } });
  const event = await prisma.minibarEvent.create({
    data: {
      roomId: room?.id,
      roomNumber: payload.roomNumber,
      sensorId: payload.sensorId,
      itemCode: payload.itemCode,
      deltaQty: payload.deltaQty ?? -1,
      rawPayloadJson: payload.raw ? JSON.stringify(payload.raw) : null,
    },
  });

  const item = await prisma.minibarItem.findFirst({ where: { code: payload.itemCode, active: true } });
  if (!room || !item) return { event, posted: false };

  const inHouse = await prisma.reservation.findFirst({
    where: { roomId: room.id, status: 'IN_HOUSE' },
    select: { id: true },
  });

  const posting = await postMinibar({
    roomId: room.id,
    itemId: item.id,
    qty: Math.abs(payload.deltaQty ?? 1),
    reservationId: inHouse?.id,
  });

  await prisma.minibarEvent.update({
    where: { id: event.id },
    data: { reconciled: true, postingId: posting.id },
  });

  return { event, posted: true, posting };
}

export async function listUnreconciledMinibarEvents() {
  return prisma.minibarEvent.findMany({
    where: { reconciled: false },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}
