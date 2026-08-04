import { prisma } from '@/lib/prisma';
import { assertSanatoriumBookingAllowed } from '@/lib/integration/clinic-capacity-client';
import { dispatchSanatoriumBookingCreated } from '@/lib/integration/guest-lifecycle-events';
import { countNights, decimalToNumber, toDecimal } from '@/lib/decimal';
import { assertActiveForNewUse, assertRoomInventoryAvailable } from '@/lib/master-data/retire-policy';
import { openFoliosForReservation, postCharge } from '@/lib/services/folio.service';
import { hasStopSellInRange } from '@/lib/services/channel.service';
import {
  applyContractRuleToNightly,
  findApplicableContractRule,
} from '@/lib/services/contract-pricing.service';
import { assertContractAllotmentAvailable, getAvailabilityWithContractAllotment } from '@/lib/services/contract-allotment.service';
import { findActiveSalesContract } from '@/lib/services/sales-contract.service';
import { quoteReservationStay } from '@/lib/services/pricing-quote.service';
import type { PaymentMethod, ReservationStatus } from '@prisma/client';
import { paxHasRealName, reservationNamesIncomplete } from '@/lib/reservation-names';

export async function listReservations(status?: ReservationStatus, guestId?: string) {
  return prisma.reservation.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(guestId ? { guestId } : {}),
    },
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
  agencyId?: string;
  salesContractId?: string;
  checkInDate: Date;
  checkOutDate: Date;
  paymentMethod: PaymentMethod;
}) {
  let ratePlanId = input.ratePlanId;
  let agencyId = input.agencyId;
  let salesContractId = input.salesContractId;

  if (salesContractId) {
    const contract = await findActiveSalesContract(salesContractId, input.checkInDate);
    if (!contract) throw new Error('Sales contract is not active for check-in date');
    ratePlanId = contract.ratePlanId;
    agencyId = contract.agencyId ?? agencyId;
    await assertContractAllotmentAvailable(
      salesContractId,
      input.roomTypeId,
      input.checkInDate,
      input.checkOutDate,
    );
  }

  const availability = salesContractId
    ? (
        await getAvailabilityWithContractAllotment(
          input.roomTypeId,
          input.checkInDate,
          input.checkOutDate,
          salesContractId,
        )
      ).available
    : (await getAvailability(input.roomTypeId, input.checkInDate, input.checkOutDate)).available;
  if (availability < 1) throw new Error('No availability for room type');

  const roomType = await prisma.roomType.findUnique({ where: { id: input.roomTypeId } });
  if (!roomType) throw new Error('Room type not found');
  assertActiveForNewUse(`Room type ${roomType.code}`, roomType.active);

  if (input.roomId) {
    const room = await prisma.room.findUnique({ where: { id: input.roomId } });
    if (!room) throw new Error('Room not found');
    assertRoomInventoryAvailable(room);
    if (room.roomTypeId !== input.roomTypeId) throw new Error('Room does not match room type');
    if (!['AVAILABLE', 'CLEAN', 'INSPECTED'].includes(room.status)) {
      throw new Error('Room is not available for booking');
    }
  }

  const ratePlan = await prisma.ratePlan.findUnique({ where: { id: ratePlanId } });
  if (!ratePlan) throw new Error('Rate plan not found');
  assertActiveForNewUse(`Rate plan ${ratePlan.code}`, ratePlan.active);

  if (agencyId) {
    const agency = await prisma.agency.findUnique({ where: { id: agencyId } });
    if (!agency) throw new Error('Agency not found');
    assertActiveForNewUse(`Agency ${agency.code}`, agency.active);
  }

  let totalAmount = toDecimal(0);
  try {
    const quote = await quoteReservationStay({
      ratePlanId,
      roomTypeId: input.roomTypeId,
      checkInDate: input.checkInDate,
      checkOutDate: input.checkOutDate,
      agencyId,
    });
    totalAmount = toDecimal(quote.totalAmount);
  } catch {
    const nights = countNights(input.checkInDate, input.checkOutDate);
    const baseNightly = decimalToNumber(ratePlan.pricePerNight);
    const rule = await findApplicableContractRule(ratePlanId, input.checkInDate, agencyId);
    const { nightly } = applyContractRuleToNightly(baseNightly, rule);
    totalAmount = toDecimal(nightly * nights);
  }

  const reservation = await prisma.reservation.create({
    data: {
      roomTypeId: input.roomTypeId,
      guestId: input.guestId,
      ratePlanId,
      mealPlanId: input.mealPlanId,
      roomId: input.roomId,
      sourceId: input.sourceId,
      agencyId,
      salesContractId,
      checkInDate: input.checkInDate,
      checkOutDate: input.checkOutDate,
      paymentMethod: input.paymentMethod,
      totalAmount,
      contractRef: salesContractId
        ? (await prisma.salesContract.findUnique({ where: { id: salesContractId }, select: { code: true } }))?.code
        : undefined,
      status: 'CONFIRMED',
    },
    include: { room: true, roomType: true, guest: true, ratePlan: true, agency: true },
  });

  if (reservation.ratePlan.medicalFlag) {
    await assertSanatoriumBookingAllowed(reservation.checkInDate);
    void dispatchSanatoriumBookingCreated({
      reservationId: reservation.id,
      programCode: reservation.ratePlan.code,
      globalPersonId: reservation.guest.globalPersonId ?? undefined,
      guestName: reservation.guest.fullName,
      checkInDate: reservation.checkInDate.toISOString(),
      checkOutDate: reservation.checkOutDate.toISOString(),
    }).catch(() => null);
  }

  return reservation;
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
  const { assertBusinessDayOpenForPosting } = await import('@/lib/services/business-date.service');
  await assertBusinessDayOpenForPosting();

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
    const { applyHeldDepositsOnCheckIn } = await import('@/lib/services/folio-deposit.service');
    await applyHeldDepositsOnCheckIn(id);

    const { postEarlyCheckInFee } = await import('@/lib/services/early-late-fees.service');
    void postEarlyCheckInFee(id).catch((e) => console.error('Early check-in fee failed', e));

    if (!reservation.ratePlan.medicalFlag && revenueRoom) {
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
    const { dispatchGuestCheckedIn } = await import(
      '@/lib/integration/guest-lifecycle-events'
    );
    void dispatchGuestCheckedIn({
      reservationId: id,
      roomNumber: updated.room?.roomNumber ?? undefined,
      programCode: updated.ratePlan.medicalFlag ? updated.ratePlan.code : undefined,
      globalPersonId: updated.guest.globalPersonId ?? undefined,
      guestName: updated.guest.fullName,
      checkInDate: reservation.checkInDate.toISOString(),
      checkOutDate: reservation.checkOutDate.toISOString(),
    }).catch((e) => console.error('Guest lifecycle check-in failed', e));
    if (
      process.env.ERA_DOOR_LOCK_ENABLED === '1' &&
      updated.room?.roomNumber
    ) {
      const { getDoorLockAdapter } = await import(
        '@/lib/integrations/door-lock-adapter'
      );
      void getDoorLockAdapter()
        .unlockRoom({
          roomNumber: updated.room.roomNumber,
          reservationId: id,
        })
        .catch((e) => console.error('Door lock unlock on check-in failed', e));
    }
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

  const updated = await prisma.reservation.update({
    where: { id },
    data: {
      checkInDate: newCheckIn,
      checkOutDate: newCheckOut,
      roomId: newRoomId,
      totalAmount,
    },
    include: { room: true, guest: true, ratePlan: true, roomType: true },
  });

  if (
    input.checkOutDate &&
    input.checkOutDate.getTime() !== reservation.checkOutDate.getTime()
  ) {
    const { recalcReservationDailyRates } = await import('./reservation-pricing.service');
    await recalcReservationDailyRates(id).catch(() => undefined);
  }

  return updated;
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

/** Guest ids that are a real named claim on this stay (not TBA / empty pax). */
export function namedGuestIdsOnStay(input: {
  guestId: string;
  guestFullName?: string | null;
  adults: number;
  pax: Array<{
    guestId?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  }>;
}): string[] {
  const ids = new Set<string>();
  for (const row of input.pax) {
    if (row.guestId && paxHasRealName(row)) ids.add(row.guestId);
  }
  if (
    !reservationNamesIncomplete({
      guestFullName: input.guestFullName,
      adults: input.adults,
      pax: input.pax,
    })
  ) {
    ids.add(input.guestId);
  }
  return [...ids];
}

export async function assertNamedGuestsFreeOnStay(reservationId: string) {
  const stay = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { guest: true, paxGuests: true, room: true },
  });
  if (!stay) throw new Error('Reservation not found');

  const claimed = namedGuestIdsOnStay({
    guestId: stay.guestId,
    guestFullName: stay.guest.fullName,
    adults: stay.adults,
    pax: stay.paxGuests,
  });
  if (claimed.length === 0) return;

  for (const guestId of claimed) {
    const conflict = await prisma.reservation.findFirst({
      where: {
        id: { not: reservationId },
        status: { in: [...SCHEDULABLE_STATUSES] },
        checkInDate: { lt: stay.checkOutDate },
        checkOutDate: { gt: stay.checkInDate },
        OR: [{ guestId }, { paxGuests: { some: { guestId } } }],
      },
      include: {
        guest: true,
        room: true,
        paxGuests: true,
      },
    });
    if (!conflict) continue;

    const otherClaimed = namedGuestIdsOnStay({
      guestId: conflict.guestId,
      guestFullName: conflict.guest.fullName,
      adults: conflict.adults,
      pax: conflict.paxGuests,
    });
    if (!otherClaimed.includes(guestId)) continue;

    const door = conflict.room?.roomNumber ?? 'TBA';
    throw new Error(
      `Guest already named on overlapping stay (room ${door}, ${conflict.checkInDate.toISOString().slice(0, 10)} – ${conflict.checkOutDate.toISOString().slice(0, 10)})`,
    );
  }
}

