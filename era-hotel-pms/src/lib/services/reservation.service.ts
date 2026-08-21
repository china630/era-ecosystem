import { prisma } from '@/lib/prisma';
import { satelliteOrganizationId } from '@era/satellite-kit';
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
import {
  assertRoomShareAssignable,
  assertShareInventory,
  countDoorsUsedForRoomType,
  isEffectiveShare,
  reservationIsOta,
  roomStatusAllowedForShareAssign,
  syncShareGenderFromGuest,
  validateShareCandidate,
} from '@/lib/services/share-assignment.service';
import { findActiveSalesContract } from '@/lib/services/sales-contract.service';
import { quoteReservationStay } from '@/lib/services/pricing-quote.service';
import { paxHasRealName, reservationNamesIncomplete } from '@/lib/reservation-names';
import type { PaymentMethod, ReservationStatus } from '@prisma/client';

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

export async function getAvailability(roomTypeId: string, from: Date, to: Date, excludeReservationId?: string) {
  const roomType = await prisma.roomType.findUnique({ where: { id: roomTypeId } });
  if (!roomType) throw new Error('Room type not found');

  const booked = await countDoorsUsedForRoomType(roomTypeId, from, to, excludeReservationId);

  const stopSell = await hasStopSellInRange(roomTypeId, from, to);
  const effectiveQuota = stopSell ? 0 : roomType.baseQuota;

  return {
    quota: roomType.baseQuota,
    booked,
    stopSell,
    available: Math.max(0, effectiveQuota - booked),
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
  /** Booking envelope (ReservationGroup) — multi-stay under one group. */
  groupId?: string;
  checkInDate: Date;
  checkOutDate: Date;
  paymentMethod: PaymentMethod;
  adults?: number;
  children11_6?: number;
  children5_2?: number;
  children1_0?: number;
  partyBillingMode?: 'PRIMARY' | 'EQUAL';
  booker?: string;
  guestRep?: string;
  paidBy?: string;
  contractRef?: string;
  /**
   * When false (group hold / extra rooms), keep pax first/last empty so names-incomplete
   * gate applies and the same booker is not treated as a named claim on every stay.
   */
  copyGuestNameToPax?: boolean;
  shareEligible?: boolean;
  /** Default CONFIRMED; agency portal uses OPTION when auto-confirm is off. */
  status?: 'OPTION' | 'CONFIRMED';
  externalRef?: string;
}) {
  let ratePlanId = input.ratePlanId;
  let agencyId = input.agencyId;
  let salesContractId = input.salesContractId;
  const partyBillingMode = input.partyBillingMode ?? 'PRIMARY';

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

  const ratePlan = await prisma.ratePlan.findUnique({ where: { id: ratePlanId } });
  if (!ratePlan) throw new Error('Rate plan not found');
  assertActiveForNewUse(`Rate plan ${ratePlan.code}`, ratePlan.active);

  const guestMaster = await prisma.guest.findUnique({ where: { id: input.guestId } });
  if (!guestMaster) throw new Error('Guest not found');

  const shareEligible = input.shareEligible ?? false;
  let shareGender: string | null = null;
  let shareBedIndex: number | null = null;
  if (shareEligible) {
    if (agencyId) {
      const agencyForOta = await prisma.agency.findUnique({ where: { id: agencyId } });
      if (
        agencyForOta &&
        (await import('@/lib/booking-source-kind')).isOtaAgency(agencyForOta.code, agencyForOta.name)
      ) {
        throw new Error('OTA reservations cannot use shared twin assignment');
      }
    }
    shareGender = syncShareGenderFromGuest(true, guestMaster.gender);
    validateShareCandidate({
      shareEligible: true,
      shareGender,
      adults: input.adults ?? 1,
    });
    await assertShareInventory(input.roomTypeId, input.checkInDate, input.checkOutDate, {
      shareEligible: true,
      shareGender,
      adults: input.adults ?? 1,
      roomId: input.roomId,
    });
  }

  if (input.roomId) {
    const room = await prisma.room.findUnique({ where: { id: input.roomId } });
    if (!room) throw new Error('Room not found');
    assertRoomInventoryAvailable(room);
    if (room.roomTypeId !== input.roomTypeId) throw new Error('Room does not match room type');
    const candidate = {
      shareEligible,
      shareGender,
      adults: input.adults ?? 1,
    };
    const { shareBedIndex: bedIdx, joiningPool } = await assertRoomShareAssignable({
      roomId: input.roomId,
      checkIn: input.checkInDate,
      checkOut: input.checkOutDate,
      candidate,
    });
    shareBedIndex = bedIdx;
    if (!roomStatusAllowedForShareAssign(room.status, joiningPool)) {
      throw new Error('Room is not available for booking');
    }
  }

  const copyNames = input.copyGuestNameToPax !== false;
  const guestNameParts = guestMaster.fullName.trim().split(/\s+/).filter(Boolean);
  const paxFirstName = copyNames ? guestNameParts[0] || undefined : undefined;
  const paxLastName = copyNames
    ? guestNameParts.length > 1
      ? guestNameParts.slice(1).join(' ')
      : undefined
    : undefined;

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
      organizationId: satelliteOrganizationId(),
      roomTypeId: input.roomTypeId,
      guestId: input.guestId,
      ratePlanId,
      mealPlanId: input.mealPlanId,
      roomId: input.roomId,
      sourceId: input.sourceId,
      agencyId,
      salesContractId,
      groupId: input.groupId,
      checkInDate: input.checkInDate,
      checkOutDate: input.checkOutDate,
      paymentMethod: input.paymentMethod,
      totalAmount,
      /** Variant A: one Reservation = one room stay */
      roomCount: 1,
      adults: input.adults ?? 1,
      children11_6: input.children11_6 ?? 0,
      children5_2: input.children5_2 ?? 0,
      children1_0: input.children1_0 ?? 0,
      partyBillingMode,
      booker: input.booker,
      guestRep: input.guestRep,
      paidBy: input.paidBy,
      contractRef:
        input.contractRef ||
        (salesContractId
          ? (await prisma.salesContract.findUnique({ where: { id: salesContractId }, select: { code: true } }))
              ?.code
          : undefined),
      shareEligible,
      shareGender,
      shareBedIndex,
      status: input.status ?? 'CONFIRMED',
      externalRef: input.externalRef,
      paxGuests: {
        create: [
          {
            guestId: input.guestId,
            firstName: paxFirstName,
            lastName: paxLastName,
            isPrimary: true,
            ownsFolio: true,
            sortOrder: 0,
          },
        ],
      },
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
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      guest: true,
      paxGuests: { orderBy: { sortOrder: 'asc' } },
    },
  });
  if (!reservation) throw new Error('Reservation not found');
  if (!['CONFIRMED', 'OPTION'].includes(reservation.status)) {
    throw new Error('Assign is only allowed for CONFIRMED or OPTION reservations');
  }

  const { reservationNamesIncomplete } = await import('@/lib/reservation-names');
  if (
    reservationNamesIncomplete({
      guestFullName: reservation.guest.fullName,
      adults: reservation.adults,
      pax: reservation.paxGuests,
    })
  ) {
    throw new Error('Guest names incomplete — fill real names before assign');
  }

  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) throw new Error('Room not found');
  if (room.roomTypeId !== reservation.roomTypeId) throw new Error('Room type mismatch');

  const candidate = {
    shareEligible: reservation.shareEligible,
    shareGender: reservation.shareGender ?? reservation.guest.gender,
    adults: reservation.adults,
    isOta: await reservationIsOta(reservationId),
  };
  const { shareBedIndex, joiningPool } = await assertRoomShareAssignable({
    roomId,
    checkIn: reservation.checkInDate,
    checkOut: reservation.checkOutDate,
    excludeReservationId: reservationId,
    candidate,
  });
  if (!roomStatusAllowedForShareAssign(room.status, joiningPool)) {
    throw new Error(
      `Room ${room.roomNumber} is ${room.status}; must be AVAILABLE, CLEAN, or INSPECTED to assign`,
    );
  }
  await assertNamedGuestsFreeOnStay(reservationId);

  return prisma.reservation.update({
    where: { id: reservationId },
    data: { roomId, shareBedIndex },
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
  const joiningSharePool =
    reservation.shareEligible &&
    isEffectiveShare({
      shareEligible: reservation.shareEligible,
      shareGender: reservation.shareGender,
      adults: reservation.adults,
    }) &&
    room?.status === 'OCCUPIED';
  if (
    !room ||
    (!joiningSharePool && !['AVAILABLE', 'CLEAN', 'INSPECTED'].includes(room.status))
  ) {
    throw new Error(
      `Room ${room?.roomNumber ?? ''} is ${room?.status ?? 'missing'}; must be AVAILABLE, CLEAN, or INSPECTED for check-in`,
    );
  }
  await assertNamedGuestsFreeOnStay(id);

  const revenueRoom = await prisma.revenueCode.findFirst({ where: { code: 'ROOM' } });

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
      data: {
        status: noShow ? 'NO_SHOW' : 'CANCELLED',
        shareBedIndex: null,
      },
      include: { room: true, guest: true },
    });
    if (reservation.roomId) {
      const { releaseDoorAfterShareDeparture } = await import(
        '@/lib/services/share-assignment.service'
      );
      await releaseDoorAfterShareDeparture(tx, {
        roomId: reservation.roomId,
        excludeReservationId: id,
        shareBedIndex: reservation.shareBedIndex,
        wasInHouse: reservation.status === 'IN_HOUSE',
      });
    }
    return updated;
  });
}

const SCHEDULABLE_STATUSES = ['CONFIRMED', 'IN_HOUSE', 'OPTION'] as const;
const BLOCKED_ROOM_STATUSES = ['OOO', 'OOS'] as const;

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

/**
 * Block the same named guest on overlapping stays (any booking / room).
 * TBA booker holds (incomplete names) do not claim the person.
 */
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

export async function assertRoomFree(
  roomId: string,
  checkIn: Date,
  checkOut: Date,
  excludeReservationId?: string,
  candidate?: {
    shareEligible: boolean;
    shareGender: string | null;
    adults: number;
    isOta?: boolean;
  },
) {
  if (candidate?.shareEligible && isEffectiveShare(candidate)) {
    await assertRoomShareAssignable({
      roomId,
      checkIn,
      checkOut,
      excludeReservationId,
      candidate,
    });
    return;
  }

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

  const nights = countNights(newCheckIn, newCheckOut);
  const totalAmount = toDecimal(decimalToNumber(reservation.ratePlan.pricePerNight) * nights);

  if (newRoomId) {
    const room = await prisma.room.findUnique({ where: { id: newRoomId } });
    if (!room) throw new Error('Room not found');
    if (room.roomTypeId !== reservation.roomTypeId) {
      throw new Error('Room does not match reservation room type');
    }
    if (BLOCKED_ROOM_STATUSES.includes(room.status as (typeof BLOCKED_ROOM_STATUSES)[number])) {
      throw new Error(`Room ${room.roomNumber} is ${room.status} and cannot be assigned`);
    }
    const candidate = {
      shareEligible: reservation.shareEligible,
      shareGender: reservation.shareGender,
      adults: reservation.adults,
      isOta: await reservationIsOta(id),
    };
    const { shareBedIndex, joiningPool } = await assertRoomShareAssignable({
      roomId: newRoomId,
      checkIn: newCheckIn,
      checkOut: newCheckOut,
      excludeReservationId: id,
      candidate,
    });
    if (!roomStatusAllowedForShareAssign(room.status, joiningPool)) {
      throw new Error(`Room ${room.roomNumber} is ${room.status} and cannot be assigned`);
    }
    await assertShareInventory(reservation.roomTypeId, newCheckIn, newCheckOut, {
      id,
      shareEligible: reservation.shareEligible,
      shareGender: reservation.shareGender,
      adults: reservation.adults,
      roomId: newRoomId,
    });
    const updated = await prisma.reservation.update({
      where: { id },
      data: {
        checkInDate: newCheckIn,
        checkOutDate: newCheckOut,
        roomId: newRoomId,
        shareBedIndex,
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

  await assertShareInventory(reservation.roomTypeId, newCheckIn, newCheckOut, {
    id,
    shareEligible: reservation.shareEligible,
    shareGender: reservation.shareGender,
    adults: reservation.adults,
    roomId: newRoomId ?? reservation.roomId,
  });

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

