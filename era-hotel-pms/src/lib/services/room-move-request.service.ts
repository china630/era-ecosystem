import { prisma } from '@/lib/prisma';
import { canAssignDoor } from '@/lib/room-state';
import { hotelDateKey, parseHotelNoon } from '@/lib/hotel-calendar';
import {
  doorTypeNeedsSettlement,
  isClassSettlement,
  readSettlement,
  settlementNote,
  type ClassSettlement,
} from '@/lib/room-move-settlement';

export {
  CLASS_SETTLEMENTS,
  doorTypeNeedsSettlement,
  isClassSettlement,
  readSettlement,
  settlementNote,
  type ClassSettlement,
} from '@/lib/room-move-settlement';

const RELOCATABLE = ['CONFIRMED', 'IN_HOUSE', 'OPTION'] as const;
const GUEST_PAYS: ClassSettlement[] = ['GUEST_PAY', 'HOTEL_REFUND', 'GUEST_CHEAPER'];

export class RoomTypeSettlementRequiredError extends Error {
  readonly status = 409;
  readonly code = 'ROOM_TYPE_SETTLEMENT_REQUIRED';
  constructor() {
    super('Choose who pays the room class difference');
    this.name = 'RoomTypeSettlementRequiredError';
  }
}

export type RoomMoveRequestInput = {
  effectiveDate?: string | null;
  reasonCode?: string | null;
  settlement?: ClassSettlement | null;
  actorUserId?: string | null;
  request?: Request;
  /** Apply an existing PENDING plan instead of inserting another row. */
  plannedId?: string | null;
};

export type RoomMoveRequestResult = { pending: boolean; planId: string | null };

async function businessTodayKey(): Promise<string> {
  const { getCurrentBusinessDate } = await import('@/lib/services/business-date.service');
  return hotelDateKey(await getCurrentBusinessDate());
}

async function doorReadyForMove(roomId: string, reservationId: string): Promise<boolean> {
  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) return false;
  const occupied = await prisma.reservation.findFirst({
    where: { roomId, status: 'IN_HOUSE', id: { not: reservationId } },
    select: { id: true },
  });
  return canAssignDoor(room, Boolean(occupied));
}

async function applyGuestClass(reservationId: string, doorRoomTypeId: string, effectiveYmd: string) {
  await prisma.reservation.update({
    where: { id: reservationId },
    data: { roomTypeId: doorRoomTypeId, givenRoomTypeId: null },
  });
  const from = parseHotelNoon(effectiveYmd);
  await prisma.reservationStaySlice.updateMany({
    where: { reservationId, toDate: { gt: from } },
    data: { roomTypeId: doorRoomTypeId },
  });
  const { recalcReservationDailyRates } = await import('@/lib/services/reservation-pricing.service');
  await recalcReservationDailyRates(reservationId, { remainingFrom: from });
}

export async function applyRoomMoveNow(
  reservationId: string,
  toRoomId: string,
  input: RoomMoveRequestInput,
): Promise<void> {
  const stay = await prisma.reservation.findUnique({ where: { id: reservationId } });
  if (!stay) throw new Error('Reservation not found');
  const door = await prisma.room.findUnique({ where: { id: toRoomId } });
  if (!door) throw new Error('Room not found');
  if (input.settlement && GUEST_PAYS.includes(input.settlement)) {
    const today = input.effectiveDate?.slice(0, 10) || (await businessTodayKey());
    await applyGuestClass(reservationId, door.roomTypeId, today);
  }
  const { relocateReservationRoom } = await import('@/lib/services/reservation-relocate.service');
  await relocateReservationRoom(reservationId, toRoomId, {
    reasonCode: input.reasonCode ?? undefined,
    compUpgrade: input.settlement === 'HOTEL',
    actorUserId: input.actorUserId ?? undefined,
    request: input.request,
    plannedId: input.plannedId ?? undefined,
  });
}

/**
 * One room move. A free door moves now.
 * Before check-in there is no move plan. The room number changes immediately when the
 * stay dates are free: a dirty door and a guest who is in-house today but leaves before
 * this arrival do not block. Overlapping dates are refused. A plan exists only for an
 * in-house guest, until the target is Clean or Inspected, in service, and empty, or when
 * that guest's move date is still in the future.
 * No stay slice is written ahead of an in-house move, so charges stay on the occupied door.
 */
export async function requestRoomMove(
  reservationId: string,
  toRoomId: string,
  input: RoomMoveRequestInput = {},
): Promise<RoomMoveRequestResult> {
  const stay = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { room: true },
  });
  if (!stay) throw new Error('Reservation not found');
  if (!RELOCATABLE.includes(stay.status as (typeof RELOCATABLE)[number])) {
    throw new Error('Room move only for CONFIRMED, IN_HOUSE, or OPTION');
  }
  if (stay.roomId === toRoomId) throw new Error('Guest is already in that room');

  const door = await prisma.room.findUnique({ where: { id: toRoomId } });
  if (!door) throw new Error('Room not found');

  const { assertNamedGuestsFreeOnStay } = await import('@/lib/services/reservation.service');
  await assertNamedGuestsFreeOnStay(reservationId);

  const needsSettlement = doorTypeNeedsSettlement(stay.roomTypeId, stay.givenRoomTypeId, door.roomTypeId);
  if (needsSettlement && !isClassSettlement(input.settlement)) {
    throw new RoomTypeSettlementRequiredError();
  }

  const today = await businessTodayKey();
  const explicit = input.effectiveDate?.slice(0, 10);
  const arrival = hotelDateKey(stay.checkInDate);
  const departure = hotelDateKey(stay.checkOutDate);
  const effectiveYmd = explicit || (today < arrival ? arrival : today);
  if (effectiveYmd < arrival || effectiveYmd >= departure) {
    throw new Error('Move date must be inside the stay');
  }

  const scheduledForLater = Boolean(explicit && explicit > today);
  const preArrival = stay.status !== 'IN_HOUSE';
  if (preArrival) {
    await prisma.roomChangePlan.updateMany({
      where: { reservationId, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });
    if (explicit && explicit > arrival) {
      const { splitStayFromDate } = await import('@/lib/services/stay-slice.service');
      await splitStayFromDate({
        reservationId,
        fromDate: parseHotelNoon(explicit),
        roomTypeId: door.roomTypeId,
        roomId: toRoomId,
        actorUserId: input.actorUserId,
      });
      return { pending: false, planId: null };
    }
    await applyRoomMoveNow(reservationId, toRoomId, { ...input, effectiveDate: effectiveYmd });
    return { pending: false, planId: null };
  }
  const ready =
    !scheduledForLater && (await doorReadyForMove(toRoomId, reservationId));
  if (ready) {
    await prisma.roomChangePlan.updateMany({
      where: { reservationId, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });
    await applyRoomMoveNow(reservationId, toRoomId, { ...input, effectiveDate: effectiveYmd });
    return { pending: false, planId: null };
  }

  const notes = isClassSettlement(input.settlement) ? settlementNote(input.settlement) : null;
  await prisma.roomChangePlan.updateMany({
    where: {
      reservationId,
      status: 'PENDING',
      ...(input.plannedId ? { id: { not: input.plannedId } } : {}),
    },
    data: { status: 'CANCELLED' },
  });
  const plan = input.plannedId
    ? await prisma.roomChangePlan.update({
        where: { id: input.plannedId },
        data: {
          toRoomId,
          fromRoomId: stay.roomId,
          effectiveAt: parseHotelNoon(effectiveYmd),
          reasonCode: input.reasonCode ?? undefined,
          notes,
          createdByUserId: input.actorUserId ?? undefined,
          status: 'PENDING',
          kind: 'SCHEDULED',
        },
      })
    : await prisma.roomChangePlan.create({
        data: {
          organizationId: stay.organizationId,
          reservationId,
          fromRoomId: stay.roomId,
          toRoomId,
          effectiveAt: parseHotelNoon(effectiveYmd),
          kind: 'SCHEDULED',
          status: 'PENDING',
          reasonCode: input.reasonCode ?? undefined,
          notes,
          createdByUserId: input.actorUserId ?? undefined,
        },
      });

  const { recordReservationAudit } = await import('@/lib/reservation-audit');
  await recordReservationAudit(
    reservationId,
    'ROOM_MOVE_PLANNED',
    { userId: input.actorUserId, request: input.request },
    {
      section: 'card',
      source: 'user',
      fields: [
        { key: 'roomNumber', from: stay.room?.roomNumber ?? null, to: door.roomNumber },
        { key: 'effectiveDate', from: null, to: effectiveYmd },
      ],
    },
  );
  return { pending: true, planId: plan.id };
}

/** When a door becomes Clean or Inspected and in service, run waiting moves onto it. */
export async function applyPendingMovesForDoor(roomId: string): Promise<void> {
  if (!(await doorReadyForMove(roomId, ''))) return;
  const today = await businessTodayKey();
  const end = new Date(`${today}T23:59:59.999+04:00`);
  const plans = await prisma.roomChangePlan.findMany({
    where: {
      toRoomId: roomId,
      status: 'PENDING',
      kind: 'SCHEDULED',
      effectiveAt: { lte: end },
    },
    orderBy: { effectiveAt: 'asc' },
    include: {
      reservation: { select: { roomTypeId: true, givenRoomTypeId: true, status: true } },
    },
  });
  const door = await prisma.room.findUnique({ where: { id: roomId } });
  if (!door) return;
  for (const plan of plans) {
    if (!RELOCATABLE.includes(plan.reservation.status as (typeof RELOCATABLE)[number])) continue;
    if (!(await doorReadyForMove(roomId, plan.reservationId))) continue;
    const settlement = readSettlement(plan.notes);
    const needs = doorTypeNeedsSettlement(
      plan.reservation.roomTypeId,
      plan.reservation.givenRoomTypeId,
      door.roomTypeId,
    );
    if (needs && !settlement) continue;
    await applyRoomMoveNow(plan.reservationId, roomId, {
      effectiveDate: hotelDateKey(plan.effectiveAt),
      reasonCode: plan.reasonCode,
      settlement,
      actorUserId: plan.createdByUserId,
      plannedId: plan.id,
    });
  }
}
