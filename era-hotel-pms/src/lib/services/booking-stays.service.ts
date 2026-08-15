import { prisma } from '@/lib/prisma';
import { createReservation } from '@/lib/services/reservation.service';
import type { BookingFolioMode, PaymentMethod } from '@prisma/client';

export async function listBookingStays(groupId: string) {
  const group = await prisma.reservationGroup.findUnique({
    where: { id: groupId },
    include: {
      agency: { select: { id: true, code: true, name: true } },
      allotmentBlock: { select: { id: true, code: true, status: true } },
      reservations: {
        orderBy: { checkInDate: 'asc' },
        include: {
          roomType: { select: { id: true, code: true, name: true } },
          room: { select: { id: true, roomNumber: true } },
          guest: { select: { id: true, fullName: true } },
          paxGuests: { where: { isPrimary: true }, take: 1 },
          ratePlan: { select: { id: true, code: true } },
        },
      },
    },
  });
  if (!group) throw new Error('Booking (group) not found');
  return group;
}

export async function updateBookingEnvelope(
  groupId: string,
  input: {
    name?: string | null;
    agencyId?: string | null;
    folioMode?: BookingFolioMode;
    allotmentBlockId?: string | null;
    checkInDate?: Date | null;
    checkOutDate?: Date | null;
    notes?: string | null;
  },
) {
  return prisma.reservationGroup.update({
    where: { id: groupId },
    data: {
      name: input.name === undefined ? undefined : input.name,
      agencyId: input.agencyId === undefined ? undefined : input.agencyId,
      folioMode: input.folioMode,
      allotmentBlockId: input.allotmentBlockId === undefined ? undefined : input.allotmentBlockId,
      checkInDate: input.checkInDate === undefined ? undefined : input.checkInDate,
      checkOutDate: input.checkOutDate === undefined ? undefined : input.checkOutDate,
      notes: input.notes === undefined ? undefined : input.notes,
    },
  });
}

/** Add one RoomStay (Reservation) under a Booking — variant A. */
export async function addStayToBooking(input: {
  groupId: string;
  roomTypeId: string;
  guestId: string;
  ratePlanId: string;
  mealPlanId?: string;
  checkInDate: Date;
  checkOutDate: Date;
  paymentMethod: PaymentMethod;
  agencyId?: string;
  salesContractId?: string;
  sourceId?: string;
  adults?: number;
}) {
  const group = await prisma.reservationGroup.findUnique({ where: { id: input.groupId } });
  if (!group) throw new Error('Booking (group) not found');

  return createReservation({
    roomTypeId: input.roomTypeId,
    guestId: input.guestId,
    ratePlanId: input.ratePlanId,
    mealPlanId: input.mealPlanId,
    agencyId: input.agencyId ?? group.agencyId ?? undefined,
    salesContractId: input.salesContractId,
    sourceId: input.sourceId,
    groupId: input.groupId,
    checkInDate: input.checkInDate,
    checkOutDate: input.checkOutDate,
    paymentMethod: input.paymentMethod,
    adults: input.adults,
    copyGuestNameToPax: false,
  });
}

export type GroupBookingStayLine = {
  roomTypeId: string;
  quantity: number;
  adults: number;
  children11_6?: number;
  children5_2?: number;
  children1_0?: number;
  ratePlanId?: string;
  /** Optional per-stay override; defaults to group envelope dates. */
  checkInDate?: Date;
  checkOutDate?: Date;
};

/** Create Booking envelope + N RoomStay rows (1 stay = 1 room). */
export async function createGroupBookingWithStays(input: {
  code?: string;
  name: string;
  agencyId?: string;
  folioMode?: BookingFolioMode;
  checkInDate: Date;
  checkOutDate: Date;
  guestId: string;
  ratePlanId: string;
  mealPlanId?: string;
  paymentMethod?: PaymentMethod;
  sourceId?: string;
  salesContractId?: string;
  booker?: string;
  guestRep?: string;
  paidBy?: string;
  contractRef?: string;
  lines: GroupBookingStayLine[];
}) {
  if (!input.lines.length) throw new Error('At least one room stay line is required');
  if (!input.name?.trim()) throw new Error('Booking name is required');
  const code =
    input.code?.trim() ||
    `GRP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  const group = await prisma.reservationGroup.create({
    data: {
      code,
      name: input.name.trim(),
      agencyId: input.agencyId,
      folioMode: input.folioMode ?? 'MASTER',
      checkInDate: input.checkInDate,
      checkOutDate: input.checkOutDate,
    },
  });

  const stays = [];
  for (const line of input.lines) {
    const qty = Math.max(1, Math.floor(line.quantity));
    const ratePlanId = line.ratePlanId || input.ratePlanId;
    const stayIn = line.checkInDate ?? input.checkInDate;
    const stayOut = line.checkOutDate ?? input.checkOutDate;
    if (stayOut <= stayIn) throw new Error('Stay check-out must be after check-in');
    for (let i = 0; i < qty; i++) {
      const stay = await createReservation({
        roomTypeId: line.roomTypeId,
        guestId: input.guestId,
        ratePlanId,
        mealPlanId: input.mealPlanId,
        agencyId: input.agencyId,
        salesContractId: input.salesContractId,
        sourceId: input.sourceId,
        groupId: group.id,
        checkInDate: stayIn,
        checkOutDate: stayOut,
        paymentMethod: input.paymentMethod ?? 'CARD',
        adults: line.adults,
        children11_6: line.children11_6,
        children5_2: line.children5_2,
        children1_0: line.children1_0,
        partyBillingMode: 'PRIMARY',
        booker: input.booker,
        guestRep: input.guestRep,
        paidBy: input.paidBy,
        contractRef: input.contractRef,
        /** Booker is a hold on each room until FO fills real party names. */
        copyGuestNameToPax: false,
      });
      stays.push(stay);
    }
  }

  return { group, stays, stayCount: stays.length };
}

/** Attach a lone RoomStay to a new Booking envelope (so FO can add more rooms). */
export async function ensureBookingGroupForReservation(reservationId: string): Promise<string> {
  const res = await prisma.reservation.findUnique({ where: { id: reservationId } });
  if (!res) throw new Error('Reservation not found');
  if (res.groupId) return res.groupId;

  const code = `GRP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;
  const group = await prisma.reservationGroup.create({
    data: {
      code,
      agencyId: res.agencyId,
      folioMode: 'INDIVIDUAL',
      checkInDate: res.checkInDate,
      checkOutDate: res.checkOutDate,
    },
  });
  await prisma.reservation.update({
    where: { id: reservationId },
    data: { groupId: group.id },
  });
  return group.id;
}

/**
 * Add another room (RoomStay) cloning product fields from the source stay.
 * Creates a Booking group first when the source stay is still standalone.
 */
export async function addRoomStayFromReservation(reservationId: string) {
  const src = await prisma.reservation.findUnique({ where: { id: reservationId } });
  if (!src) throw new Error('Reservation not found');
  const groupId = await ensureBookingGroupForReservation(reservationId);
  return addStayToBooking({
    groupId,
    roomTypeId: src.roomTypeId,
    guestId: src.guestId,
    ratePlanId: src.ratePlanId,
    mealPlanId: src.mealPlanId ?? undefined,
    checkInDate: src.checkInDate,
    checkOutDate: src.checkOutDate,
    paymentMethod: src.paymentMethod,
    agencyId: src.agencyId ?? undefined,
    salesContractId: src.salesContractId ?? undefined,
    sourceId: src.sourceId ?? undefined,
    adults: src.adults,
  });
}
