import { prisma } from '@/lib/prisma';
import { countNights, decimalToNumber, toDecimal } from '@/lib/decimal';
import { openFoliosForReservation, postCharge } from '@/lib/services/folio.service';
import { hasStopSellInRange } from '@/lib/services/channel.service';
import type { PaymentMethod, ReservationStatus } from '@prisma/client';

export async function listReservations(status?: ReservationStatus) {
  return prisma.reservation.findMany({
    where: status ? { status } : undefined,
    include: {
      room: { include: { roomType: true } },
      roomType: true,
      guest: true,
      ratePlan: true,
      mealPlan: true,
      stay: true,
      folios: { include: { charges: true, payments: true } },
    },
    orderBy: { checkInDate: 'desc' },
  });
}

export async function getReservation(id: string) {
  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: {
      room: { include: { roomType: true } },
      roomType: true,
      guest: true,
      ratePlan: true,
      mealPlan: true,
      stay: true,
      folios: { include: { charges: { include: { revenueCode: true } }, payments: true } },
    },
  });
  if (!reservation) throw new Error('Reservation not found');
  return reservation;
}

export async function getAvailability(roomTypeId: string, from: Date, to: Date) {
  const roomType = await prisma.roomType.findUnique({ where: { id: roomTypeId } });
  if (!roomType) throw new Error('Room type not found');

  const overlapping = await prisma.reservation.count({
    where: {
      roomTypeId,
      status: { in: ['CONFIRMED', 'IN_HOUSE', 'OPTION'] },
      checkInDate: { lt: to },
      checkOutDate: { gt: from },
    },
  });

  const stopSell = await hasStopSellInRange(roomTypeId, from, to);
  const effectiveQuota = stopSell ? 0 : roomType.baseQuota;

  return {
    quota: roomType.baseQuota,
    booked: overlapping,
    stopSell,
    available: Math.max(0, effectiveQuota - overlapping),
  };
}

export async function createReservation(input: {
  roomTypeId: string;
  guestId: string;
  ratePlanId: string;
  mealPlanId?: string;
  roomId?: string;
  sourceId?: string;
  checkInDate: Date;
  checkOutDate: Date;
  paymentMethod: PaymentMethod;
}) {
  const availability = await getAvailability(input.roomTypeId, input.checkInDate, input.checkOutDate);
  if (availability.available < 1) throw new Error('No availability for room type');

  if (input.roomId) {
    const room = await prisma.room.findUnique({ where: { id: input.roomId } });
    if (!room) throw new Error('Room not found');
    if (room.roomTypeId !== input.roomTypeId) throw new Error('Room does not match room type');
    if (!['AVAILABLE', 'CLEAN', 'INSPECTED'].includes(room.status)) {
      throw new Error('Room is not available for booking');
    }
  }

  const ratePlan = await prisma.ratePlan.findUnique({ where: { id: input.ratePlanId } });
  if (!ratePlan) throw new Error('Rate plan not found');

  const nights = countNights(input.checkInDate, input.checkOutDate);
  const totalAmount = toDecimal(decimalToNumber(ratePlan.pricePerNight) * nights);

  return prisma.reservation.create({
    data: {
      roomTypeId: input.roomTypeId,
      guestId: input.guestId,
      ratePlanId: input.ratePlanId,
      mealPlanId: input.mealPlanId,
      roomId: input.roomId,
      sourceId: input.sourceId,
      checkInDate: input.checkInDate,
      checkOutDate: input.checkOutDate,
      paymentMethod: input.paymentMethod,
      totalAmount,
      status: 'CONFIRMED',
    },
    include: { room: true, roomType: true, guest: true, ratePlan: true },
  });
}

export async function assignRoom(reservationId: string, roomId: string) {
  const reservation = await getReservation(reservationId);
  if (!['CONFIRMED', 'OPTION'].includes(reservation.status)) {
    throw new Error('Assign is only allowed for CONFIRMED or OPTION reservations');
  }

  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) throw new Error('Room not found');
  if (room.roomTypeId !== reservation.roomTypeId) throw new Error('Room type mismatch');
  if (!['AVAILABLE', 'CLEAN', 'INSPECTED'].includes(room.status)) {
    throw new Error('Room must be AVAILABLE, CLEAN, or INSPECTED to assign');
  }

  return prisma.reservation.update({
    where: { id: reservationId },
    data: { roomId },
    include: { room: true, guest: true, roomType: true, ratePlan: true },
  });
}

export async function listArrivals(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  return prisma.reservation.findMany({
    where: {
      checkInDate: { gte: start, lte: end },
      status: { in: ['CONFIRMED', 'OPTION'] },
    },
    include: { guest: true, roomType: true, room: true, ratePlan: true },
    orderBy: { checkInDate: 'asc' },
  });
}

export async function checkInReservation(id: string) {
  const reservation = await getReservation(id);
  if (!['CONFIRMED', 'OPTION'].includes(reservation.status)) {
    throw new Error('Check-in is only allowed for CONFIRMED or OPTION reservations');
  }
  if (!reservation.roomId) throw new Error('Assign a room before check-in');

  const room = await prisma.room.findUnique({ where: { id: reservation.roomId } });
  if (!room || !['AVAILABLE', 'CLEAN', 'INSPECTED'].includes(room.status)) {
    throw new Error('Room must be AVAILABLE, CLEAN, or INSPECTED for check-in');
  }

  const revenueRoom = await prisma.revenueCode.findUnique({ where: { code: 'ROOM' } });

  return prisma.$transaction(async (tx) => {
    const updated = await tx.reservation.update({
      where: { id },
      data: { status: 'IN_HOUSE' },
      include: { room: true, guest: true, ratePlan: true, roomType: true },
    });
    await tx.stay.create({
      data: { reservationId: id, actualCheckIn: new Date() },
    });
    await tx.room.update({
      where: { id: reservation.roomId! },
      data: { status: 'OCCUPIED' },
    });

    await openFoliosForReservation(id, updated.guest.voen);

    return updated;
  }).then(async (updated) => {
    if (revenueRoom) {
      const nights = countNights(reservation.checkInDate, reservation.checkOutDate);
      await postCharge({
        reservationId: id,
        revenueCodeId: revenueRoom.id,
        amount: decimalToNumber(reservation.ratePlan.pricePerNight),
        qty: nights,
        description: `Accommodation ${reservation.room?.roomNumber ?? ''}`,
      });
    }
    const result = await getReservation(id);
    const { submitTourismCheckIn } = await import('@/lib/services/tourism.service');
    void submitTourismCheckIn(id).catch((e) => console.error('Tourism check-in failed', e));
    return result;
  });
}

export async function cancelReservation(id: string, noShow = false) {
  const reservation = await getReservation(id);
  if (['CHECKED_OUT', 'CANCELLED'].includes(reservation.status)) {
    throw new Error('Reservation already closed');
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.reservation.update({
      where: { id },
      data: { status: noShow ? 'NO_SHOW' : 'CANCELLED' },
      include: { room: true, guest: true },
    });
    if (reservation.roomId && reservation.status === 'IN_HOUSE') {
      await tx.room.update({ where: { id: reservation.roomId }, data: { status: 'DIRTY' } });
    }
    return updated;
  });
}

const SCHEDULABLE_STATUSES = ['CONFIRMED', 'IN_HOUSE', 'OPTION'] as const;
const BLOCKED_ROOM_STATUSES = ['OOO', 'OOS'] as const;

export async function assertRoomFree(
  roomId: string,
  checkIn: Date,
  checkOut: Date,
  excludeReservationId?: string,
) {
  const conflict = await prisma.reservation.findFirst({
    where: {
      roomId,
      ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
      status: { in: [...SCHEDULABLE_STATUSES] },
      checkInDate: { lt: checkOut },
      checkOutDate: { gt: checkIn },
    },
    include: { guest: true },
  });
  if (conflict) {
    throw new Error(
      `Room conflict: ${conflict.guest.fullName} (${conflict.checkInDate.toISOString().slice(0, 10)} – ${conflict.checkOutDate.toISOString().slice(0, 10)})`,
    );
  }
}

export async function updateReservationSchedule(
  id: string,
  input: { checkInDate?: Date; checkOutDate?: Date; roomId?: string | null },
) {
  const reservation = await getReservation(id);
  if (!SCHEDULABLE_STATUSES.includes(reservation.status as (typeof SCHEDULABLE_STATUSES)[number])) {
    throw new Error('Schedule change only for CONFIRMED, IN_HOUSE, or OPTION');
  }

  const newCheckIn = input.checkInDate ?? reservation.checkInDate;
  const newCheckOut = input.checkOutDate ?? reservation.checkOutDate;
  const newRoomId = input.roomId !== undefined ? input.roomId : reservation.roomId;

  if (newCheckOut <= newCheckIn) {
    throw new Error('Check-out must be after check-in');
  }

  if (reservation.status === 'IN_HOUSE') {
    if (input.checkInDate && input.checkInDate.getTime() !== reservation.checkInDate.getTime()) {
      throw new Error('Cannot change check-in date while in-house (extend check-out only)');
    }
    if (input.checkOutDate && input.checkOutDate < reservation.checkOutDate) {
      throw new Error('Cannot shorten stay while in-house');
    }
  }

  if (newRoomId) {
    const room = await prisma.room.findUnique({ where: { id: newRoomId } });
    if (!room) throw new Error('Room not found');
    if (room.roomTypeId !== reservation.roomTypeId) {
      throw new Error('Room does not match reservation room type');
    }
    if (BLOCKED_ROOM_STATUSES.includes(room.status as (typeof BLOCKED_ROOM_STATUSES)[number])) {
      throw new Error(`Room ${room.roomNumber} is ${room.status} and cannot be assigned`);
    }
    await assertRoomFree(newRoomId, newCheckIn, newCheckOut, id);
  }

  const roomType = await prisma.roomType.findUnique({ where: { id: reservation.roomTypeId } });
  if (!roomType) throw new Error('Room type not found');

  const overlapping = await prisma.reservation.count({
    where: {
      roomTypeId: reservation.roomTypeId,
      id: { not: id },
      status: { in: [...SCHEDULABLE_STATUSES] },
      checkInDate: { lt: newCheckOut },
      checkOutDate: { gt: newCheckIn },
    },
  });
  if (overlapping + 1 > roomType.baseQuota) {
    throw new Error('No availability for room type in selected dates');
  }

  const nights = countNights(newCheckIn, newCheckOut);
  const totalAmount = toDecimal(decimalToNumber(reservation.ratePlan.pricePerNight) * nights);

  return prisma.reservation.update({
    where: { id },
    data: {
      checkInDate: newCheckIn,
      checkOutDate: newCheckOut,
      roomId: newRoomId,
      totalAmount,
    },
    include: { room: true, guest: true, ratePlan: true, roomType: true },
  });
}

export async function addQuickCharge(
  reservationId: string,
  input: { revenueCodeId: string; amount: number; qty?: number; description: string },
) {
  const reservation = await getReservation(reservationId);
  if (reservation.status !== 'IN_HOUSE') {
    throw new Error('Quick charges only for IN_HOUSE reservations');
  }
  return postCharge({ reservationId, ...input });
}
