import { prisma } from '@/lib/prisma';
import { hotelDateKey } from '@/lib/hotel-calendar';
import { recordRoomMove } from '@/lib/services/room-occupancy-log.service';
import { physicalTypeAllowedForDoor } from '@/lib/services/door-type.policy';
import { dispatchRoomChanged } from '@/lib/integration/guest-lifecycle-events';
import { REISSUE_KEY_TASK_TITLE } from '@/lib/services/depart-guest.service';
import { addReservationTask } from '@/lib/services/reservation-submodals.service';
import { clinicProgramCodeFromTariff } from '@/lib/services/medical-package-resolve.service';
import {
  doorTypeNeedsSettlement,
  isClassSettlement,
  settlementNote,
  type ClassSettlement,
} from '@/lib/room-move-settlement';
import { RoomTypeSettlementRequiredError } from '@/lib/services/room-move-request.service';

const GUEST_PAYS: ClassSettlement[] = ['GUEST_PAY', 'HOTEL_REFUND', 'GUEST_CHEAPER'];
const LIVE = ['OPTION', 'CONFIRMED', 'IN_HOUSE'] as const;

function reject(message: string, status = 409): never {
  const err = new Error(message);
  (err as Error & { status?: number }).status = status;
  throw err;
}

function swapNotes(otherRoom: string, otherId: string, settlement?: ClassSettlement | null) {
  const base = `swap-with:${otherRoom} stay:${otherId}`;
  return settlement ? `${base} ${settlementNote(settlement)}` : base;
}

/**
 * Exchange the doors of two in-house stays. They do not need a shared booking group.
 * Folios stay on their reservations. Housekeeping status is left as it was.
 * A class difference reprices remaining nights only, using the same settlement as a room move.
 */
export async function swapReservationRooms(
  reservationIdA: string,
  reservationIdB: string,
  opts?: {
    actorUserId?: string;
    request?: Request;
    settlementA?: ClassSettlement | null;
    settlementB?: ClassSettlement | null;
  },
) {
  if (reservationIdA === reservationIdB) reject('Cannot swap a stay with itself', 400);

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
  if (!a || !b) reject('Reservation not found', 404);
  if (a.organizationId !== b.organizationId) reject('Stays belong to different organizations');
  if (a.isLocked || b.isLocked) reject('Unlock the stay before swapping rooms');
  if (a.status !== 'IN_HOUSE' || b.status !== 'IN_HOUSE') {
    reject('Swap only for in-house stays');
  }
  if (!a.roomId || !b.roomId || !a.room || !b.room) {
    reject('Both stays must have an assigned room to swap', 400);
  }

  const roomA = a.room;
  const roomB = b.room;
  const fromA = a.roomId;
  const fromB = b.roomId;

  const { countRemainingInHouseOnDoor } = await import('@/lib/services/share-assignment.service');
  const [shareA, shareB] = await Promise.all([
    countRemainingInHouseOnDoor(fromA, a.id),
    countRemainingInHouseOnDoor(fromB, b.id),
  ]);
  if (shareA > 0 || shareB > 0) reject('A shared room cannot be swapped');

  if (
    doorTypeNeedsSettlement(a.roomTypeId, a.givenRoomTypeId, roomB.roomTypeId) &&
    !isClassSettlement(opts?.settlementA)
  ) {
    throw new RoomTypeSettlementRequiredError();
  }
  if (
    doorTypeNeedsSettlement(b.roomTypeId, b.givenRoomTypeId, roomA.roomTypeId) &&
    !isClassSettlement(opts?.settlementB)
  ) {
    throw new RoomTypeSettlementRequiredError();
  }

  const allowA = physicalTypeAllowedForDoor({
    chargedRoomTypeId: a.roomTypeId,
    givenRoomTypeId: a.givenRoomTypeId,
    doorRoomTypeId: roomB.roomTypeId,
    compUpgrade: isClassSettlement(opts?.settlementA),
  });
  if (!allowA.ok) reject(allowA.error ?? 'Door type not allowed');
  const allowB = physicalTypeAllowedForDoor({
    chargedRoomTypeId: b.roomTypeId,
    givenRoomTypeId: b.givenRoomTypeId,
    doorRoomTypeId: roomA.roomTypeId,
    compUpgrade: isClassSettlement(opts?.settlementB),
  });
  if (!allowB.ok) reject(allowB.error ?? 'Door type not allowed');

  const { getCurrentBusinessDate } = await import('@/lib/services/business-date.service');
  const today = await getCurrentBusinessDate();
  const [tailA, tailB] = await Promise.all([
    prisma.reservation.findFirst({
      where: {
        roomId: fromB,
        id: { notIn: [a.id, b.id] },
        status: { in: [...LIVE] },
        checkInDate: { lt: a.checkOutDate },
        checkOutDate: { gt: today },
      },
      select: { id: true },
    }),
    prisma.reservation.findFirst({
      where: {
        roomId: fromA,
        id: { notIn: [a.id, b.id] },
        status: { in: [...LIVE] },
        checkInDate: { lt: b.checkOutDate },
        checkOutDate: { gt: today },
      },
      select: { id: true },
    }),
  ]);
  if (tailA || tailB) reject('The room is booked for the rest of the stay');

  const givenA =
    opts?.settlementA && GUEST_PAYS.includes(opts.settlementA)
      ? undefined
      : roomB.roomTypeId !== a.roomTypeId
        ? roomB.roomTypeId
        : a.givenRoomTypeId;
  const givenB =
    opts?.settlementB && GUEST_PAYS.includes(opts.settlementB)
      ? undefined
      : roomA.roomTypeId !== b.roomTypeId
        ? roomA.roomTypeId
        : b.givenRoomTypeId;

  await prisma.$transaction(async (tx) => {
    const fresh = await tx.reservation.findMany({
      where: { id: { in: [a.id, b.id] } },
      select: { id: true, roomId: true },
    });
    const stillA = fresh.find((row) => row.id === a.id)?.roomId;
    const stillB = fresh.find((row) => row.id === b.id)?.roomId;
    if (stillA !== fromA || stillB !== fromB) reject('Rooms changed before the swap finished');

    await tx.roomChangePlan.updateMany({
      where: { reservationId: { in: [a.id, b.id] }, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });
    await tx.reservation.update({ where: { id: a.id }, data: { roomId: null } });
    await tx.reservation.update({ where: { id: b.id }, data: { roomId: null } });
    await tx.reservation.update({
      where: { id: a.id },
      data: {
        roomId: fromB,
        ...(givenA !== undefined ? { givenRoomTypeId: givenA } : {}),
      },
    });
    await tx.reservation.update({
      where: { id: b.id },
      data: {
        roomId: fromA,
        ...(givenB !== undefined ? { givenRoomTypeId: givenB } : {}),
      },
    });
  });

  const { moveStayDoor } = await import('@/lib/services/stay-slice.service');
  await moveStayDoor({
    reservationId: a.id,
    fromRoomId: fromA,
    toRoomId: fromB,
    status: a.status,
    checkIn: a.checkInDate,
  });
  await moveStayDoor({
    reservationId: b.id,
    fromRoomId: fromB,
    toRoomId: fromA,
    status: b.status,
    checkIn: b.checkInDate,
  });

  if (opts?.settlementA && GUEST_PAYS.includes(opts.settlementA)) {
    const { applyGuestClass } = await import('@/lib/services/room-move-request.service');
    await applyGuestClass(a.id, roomB.roomTypeId, hotelDateKey(today));
  }
  if (opts?.settlementB && GUEST_PAYS.includes(opts.settlementB)) {
    const { applyGuestClass } = await import('@/lib/services/room-move-request.service');
    await applyGuestClass(b.id, roomA.roomTypeId, hotelDateKey(today));
  }

  const noteA = swapNotes(roomB.roomNumber, b.id, opts?.settlementA);
  const noteB = swapNotes(roomA.roomNumber, a.id, opts?.settlementB);
  await recordRoomMove({
    reservationId: a.id,
    organizationId: a.organizationId,
    fromRoomId: fromA,
    toRoomId: fromB,
    effectiveAt: new Date(),
    notes: noteA,
    reasonCode: 'SWAP',
    createdByUserId: opts?.actorUserId,
    kind: 'OCCURRED',
    status: 'APPLIED',
  });
  await recordRoomMove({
    reservationId: b.id,
    organizationId: b.organizationId,
    fromRoomId: fromB,
    toRoomId: fromA,
    effectiveAt: new Date(),
    notes: noteB,
    reasonCode: 'SWAP',
    createdByUserId: opts?.actorUserId,
    kind: 'OCCURRED',
    status: 'APPLIED',
  });

  void dispatchRoomChanged({
    reservationId: a.id,
    previousRoomNumber: roomA.roomNumber,
    newRoomNumber: roomB.roomNumber,
    programCode: clinicProgramCodeFromTariff(a.ratePlan),
  }).catch(() => undefined);
  void dispatchRoomChanged({
    reservationId: b.id,
    previousRoomNumber: roomB.roomNumber,
    newRoomNumber: roomA.roomNumber,
    programCode: clinicProgramCodeFromTariff(b.ratePlan),
  }).catch(() => undefined);

  await Promise.all([
    addReservationTask(a.id, { title: REISSUE_KEY_TASK_TITLE }).catch(() => undefined),
    addReservationTask(b.id, { title: REISSUE_KEY_TASK_TITLE }).catch(() => undefined),
  ]);

  const { recordReservationAudit } = await import('@/lib/reservation-audit');
  await recordReservationAudit(
    a.id,
    'SWAP_ROOM',
    { userId: opts?.actorUserId, request: opts?.request },
    {
      section: 'card',
      source: 'user',
      fields: [
        { key: 'roomNumber', from: roomA.roomNumber, to: roomB.roomNumber },
        { key: 'swapWith', from: null, to: `${roomB.roomNumber} ${b.id}` },
        { key: 'settlement', from: null, to: opts?.settlementA ?? null },
      ],
    },
  );
  await recordReservationAudit(
    b.id,
    'SWAP_ROOM',
    { userId: opts?.actorUserId, request: opts?.request },
    {
      section: 'card',
      source: 'user',
      fields: [
        { key: 'roomNumber', from: roomB.roomNumber, to: roomA.roomNumber },
        { key: 'swapWith', from: null, to: `${roomA.roomNumber} ${a.id}` },
        { key: 'settlement', from: null, to: opts?.settlementB ?? null },
      ],
    },
  );

  return {
    a: { id: a.id, roomId: fromB, roomNumber: roomB.roomNumber },
    b: { id: b.id, roomId: fromA, roomNumber: roomA.roomNumber },
  };
}
