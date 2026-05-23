import { prisma } from '@/lib/prisma';
import { postCharge } from '@/lib/services/folio.service';
import { consumeRecipeForProduct } from '@/lib/services/stock.service';
import {
  findRoomChargeByIdempotencyKey,
  hashRoomChargeRequest,
  saveRoomChargeIdempotency,
  type RoomChargeIdempotencyInput,
} from '@/lib/services/pms-bridge.service';

export async function listPosResources() {
  return prisma.posResource.findMany({
    where: { active: true },
    orderBy: { code: 'asc' },
  });
}

export async function createPosResource(input: {
  code: string;
  name: string;
  resourceType: 'TABLE' | 'SPA_CABIN';
  outletCode?: string;
}) {
  return prisma.posResource.create({ data: input });
}

export async function listPosReservations(from: Date, to: Date) {
  return prisma.posReservation.findMany({
    where: { startAt: { lt: to }, endAt: { gt: from } },
    include: { resource: true, reservation: { include: { guest: true } } },
    orderBy: { startAt: 'asc' },
  });
}

export async function createPosReservation(input: {
  resourceId: string;
  startAt: Date;
  endAt: Date;
  partySize?: number;
  reservationId?: string;
  guestName?: string;
  notes?: string;
}) {
  const conflict = await prisma.posReservation.findFirst({
    where: {
      resourceId: input.resourceId,
      status: { in: ['BOOKED', 'SEATED'] },
      startAt: { lt: input.endAt },
      endAt: { gt: input.startAt },
    },
  });
  if (conflict) throw new Error('Resource already booked for this slot');

  return prisma.posReservation.create({
    data: {
      resourceId: input.resourceId,
      startAt: input.startAt,
      endAt: input.endAt,
      partySize: input.partySize ?? 2,
      reservationId: input.reservationId,
      guestName: input.guestName,
      notes: input.notes,
    },
    include: { resource: true },
  });
}

export async function postRoomCharge(
  input: RoomChargeIdempotencyInput & {
    idempotencyKey?: string;
  },
) {
  const idempotencyKey = input.idempotencyKey?.trim();
  const requestHash = hashRoomChargeRequest(input);

  if (idempotencyKey) {
    const existing = await findRoomChargeByIdempotencyKey(idempotencyKey);
    if (existing) {
      const row = await prisma.posRoomChargeIdempotency.findUnique({
        where: { idempotencyKey },
      });
      if (row && row.requestHash !== requestHash) {
        throw new Error('Idempotency conflict: same key with different request body');
      }
      return { charge: existing, reservationId: row!.reservationId, idempotent: true };
    }
  }

  let reservationId = input.reservationId;
  if (!reservationId && input.roomNumber) {
    const room = await prisma.room.findUnique({
      where: { roomNumber: input.roomNumber },
      include: {
        reservations: { where: { status: 'IN_HOUSE' }, take: 1 },
      },
    });
    if (!room?.reservations[0]) throw new Error('No in-house reservation for room');
    reservationId = room.reservations[0].id;
  }
  if (!reservationId) throw new Error('reservationId or roomNumber required');

  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
  });
  if (!reservation || reservation.status !== 'IN_HOUSE') {
    throw new Error('Room charge only for IN_HOUSE reservations');
  }

  const code = await prisma.revenueCode.findFirst({
    where: { code: input.revenueCode },
  });
  if (!code) throw new Error(`Revenue code ${input.revenueCode} not found`);

  const charge = await postCharge({
    reservationId,
    revenueCodeId: code.id,
    amount: input.amount,
    qty: 1,
    description: `[${input.outletCode ?? 'POS'}] ${input.description}`,
  });

  if (input.productSku) {
    await consumeRecipeForProduct(input.productSku, 1).catch(() => {
      /* optional stock */
    });
  }

  if (idempotencyKey) {
    await saveRoomChargeIdempotency(
      idempotencyKey,
      charge.id,
      reservationId,
      requestHash,
    );
  }

  return { charge, reservationId, idempotent: false };
}
