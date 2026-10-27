import type { PaymentMethod, TourBookingStatus, TourDepartureStatus } from '@prisma/client';
import { requestOrganizationId } from '@/lib/request-organization';
import { prisma } from '@/lib/prisma';
import { decimalToNumber, toDecimal } from '@/lib/decimal';
import { requireRevenueCodeByRole } from '@/lib/revenue-code-token';
import { folioBalance, postCharge, postPayment, voidCharge } from '@/lib/services/folio.service';
import { refundFolioPayment } from '@/lib/services/folio-refund.service';
import { getTourOpsPolicy } from '@/lib/services/tour-ops-policy.service';

export const TRANSFER_OCCUPANCY_MS = 90 * 60 * 1000;

const LIVE_ROSTER: TourBookingStatus[] = ['RESERVED', 'CHARGED', 'PAID', 'ON_CITY_LEDGER'];
const BOARDED_STATUSES: TourBookingStatus[] = ['CHARGED', 'PAID', 'ON_CITY_LEDGER'];

export class TourConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TourConflictError';
  }
}

async function tourRevenue() {
  return requireRevenueCodeByRole('TOUR');
}

function orgId() {
  return requestOrganizationId();
}

function seatCap(departure: { capacity: number; vehicle: { maxSeats: number } | null }) {
  if (!departure.vehicle) return departure.capacity;
  return Math.min(departure.capacity, departure.vehicle.maxSeats);
}

function countLive(bookings: Array<{ status: TourBookingStatus }>) {
  return bookings.filter((b) => LIVE_ROSTER.includes(b.status)).length;
}

function countBoarded(bookings: Array<{ status: TourBookingStatus }>) {
  return bookings.filter((b) => BOARDED_STATUSES.includes(b.status)).length;
}

export async function listTourTemplates(activeOnly = true) {
  return prisma.tourTemplate.findMany({
    where: activeOnly ? { active: true } : undefined,
    orderBy: { code: 'asc' },
  });
}

export async function createTourTemplate(input: {
  code: string;
  name: string;
  defaultAgenda?: string;
  defaultPickup?: string;
  defaultReturn?: string;
  defaultCapacity?: number;
  defaultPrice: number;
}) {
  return prisma.tourTemplate.create({
    data: {
      organizationId: orgId(),
      code: input.code,
      name: input.name,
      defaultAgenda: input.defaultAgenda ?? '',
      defaultPickup: input.defaultPickup,
      defaultReturn: input.defaultReturn,
      defaultCapacity: input.defaultCapacity ?? 20,
      defaultPrice: toDecimal(input.defaultPrice),
    },
  });
}

export async function listTourDepartures(filters?: { from?: Date; to?: Date; status?: string }) {
  return prisma.tourDeparture.findMany({
    where: {
      ...(filters?.status ? { status: filters.status as TourDepartureStatus } : {}),
      ...(filters?.from || filters?.to
        ? {
            date: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
    },
    include: {
      vehicle: true,
      template: true,
      _count: {
        select: {
          bookings: { where: { status: { in: LIVE_ROSTER } } },
        },
      },
    },
    orderBy: [{ date: 'asc' }, { pickupAt: 'asc' }],
  });
}

/** Drop RESERVED seats past AUTO_CUTOFF; closes boarding when policy says so. */
async function applyAutoCutoffIfDue(departureId: string) {
  const policy = await getTourOpsPolicy();
  if (policy.boardingCloseMode !== 'AUTO_CUTOFF') return;
  const minutes = policy.autoCutoffMinutesBeforePickup;
  if (minutes == null || minutes < 1) return;

  const departure = await prisma.tourDeparture.findUnique({
    where: { id: departureId },
    include: { bookings: true },
  });
  if (!departure) return;
  if (!['DRAFT', 'OPEN'].includes(departure.status)) return;

  const cutoffAt = new Date(departure.pickupAt.getTime() - minutes * 60 * 1000);
  if (Date.now() < cutoffAt.getTime()) return;

  // AUTO_CUTOFF always clears unboarded RESERVED seats and closes boarding.
  const reserved = departure.bookings.filter((b) => b.status === 'RESERVED');
  for (const b of reserved) {
    await prisma.tourBooking.update({
      where: { id: b.id },
      data: { status: 'CANCELLED' },
    });
  }
  await prisma.tourDeparture.update({
    where: { id: departureId },
    data: { status: 'CLOSED' },
  });
}

export async function getTourDeparture(id: string) {
  await applyAutoCutoffIfDue(id);
  const row = await prisma.tourDeparture.findUnique({
    where: { id },
    include: {
      vehicle: true,
      template: true,
      bookings: {
        include: {
          reservation: { include: { guest: true, room: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!row) throw new Error('Tour departure not found');
  return row;
}

export async function assertVehicleSlotFree(input: {
  vehicleId: string;
  from: Date;
  to: Date;
  exceptDepartureId?: string;
  exceptTransferId?: string;
}) {
  const tours = await prisma.tourDeparture.findMany({
    where: {
      vehicleId: input.vehicleId,
      status: { not: 'CANCELLED' },
      ...(input.exceptDepartureId ? { id: { not: input.exceptDepartureId } } : {}),
    },
  });
  for (const t of tours) {
    if (t.pickupAt < input.to && t.returnAt > input.from) {
      throw new TourConflictError('Vehicle is already assigned to another tour in this window');
    }
  }
  const transfers = await prisma.transferOrder.findMany({
    where: {
      vehicleId: input.vehicleId,
      status: { not: 'CANCELLED' },
      ...(input.exceptTransferId ? { id: { not: input.exceptTransferId } } : {}),
    },
  });
  for (const x of transfers) {
    const end = new Date(x.pickupAt.getTime() + TRANSFER_OCCUPANCY_MS);
    if (x.pickupAt < input.to && end > input.from) {
      throw new TourConflictError('Vehicle overlaps an airport transfer in this window');
    }
  }
}

export async function createTourDeparture(input: {
  templateId?: string;
  date: Date;
  pickupAt: Date;
  returnAt: Date;
  agenda?: string;
  meetingPoint?: string;
  guideName?: string;
  vehicleId?: string;
  capacity?: number;
  price?: number;
}) {
  let capacity = input.capacity ?? 20;
  let price = input.price ?? 0;
  let agenda = input.agenda ?? '';
  let meetingPoint = input.meetingPoint ?? '';
  if (input.templateId) {
    const tmpl = await prisma.tourTemplate.findUnique({ where: { id: input.templateId } });
    if (!tmpl) throw new Error('Tour template not found');
    capacity = input.capacity ?? tmpl.defaultCapacity;
    price = input.price ?? decimalToNumber(tmpl.defaultPrice);
    agenda = input.agenda ?? tmpl.defaultAgenda;
    meetingPoint = input.meetingPoint ?? tmpl.defaultPickup ?? '';
  }
  if (input.vehicleId) {
    const v = await prisma.transferVehicle.findUnique({ where: { id: input.vehicleId } });
    if (!v?.active) throw new Error('Vehicle not found or inactive');
    await assertVehicleSlotFree({
      vehicleId: input.vehicleId,
      from: input.pickupAt,
      to: input.returnAt,
    });
  }
  return prisma.tourDeparture.create({
    data: {
      organizationId: orgId(),
      templateId: input.templateId,
      date: input.date,
      pickupAt: input.pickupAt,
      returnAt: input.returnAt,
      agenda,
      meetingPoint,
      guideName: input.guideName,
      vehicleId: input.vehicleId,
      capacity,
      price: toDecimal(price),
      status: input.vehicleId ? 'OPEN' : 'DRAFT',
    },
    include: { vehicle: true, template: true },
  });
}

export async function updateTourDeparture(
  id: string,
  patch: {
    agenda?: string;
    meetingPoint?: string;
    guideName?: string | null;
    vehicleId?: string | null;
    pickupAt?: Date;
    returnAt?: Date;
    capacity?: number;
    price?: number;
    status?: TourDepartureStatus;
  },
) {
  const current = await prisma.tourDeparture.findUnique({
    where: { id },
    include: { vehicle: true, bookings: true },
  });
  if (!current) throw new Error('Tour departure not found');

  const pickupAt = patch.pickupAt ?? current.pickupAt;
  const returnAt = patch.returnAt ?? current.returnAt;
  const vehicleId = patch.vehicleId === undefined ? current.vehicleId : patch.vehicleId;
  const nextStatus = patch.status ?? current.status;

  if (nextStatus === 'DEPARTED' && !vehicleId) {
    throw new Error('Cannot mark departed without a vehicle');
  }

  if (vehicleId) {
    const v = await prisma.transferVehicle.findUnique({ where: { id: vehicleId } });
    if (!v?.active) throw new Error('Vehicle not found or inactive');
    await assertVehicleSlotFree({
      vehicleId,
      from: pickupAt,
      to: returnAt,
      exceptDepartureId: id,
    });
    const boarded = countBoarded(current.bookings);
    const cap = Math.min(patch.capacity ?? current.capacity, v.maxSeats);
    if (boarded > cap) throw new Error('Vehicle seat count is below boarded roster');
  }

  return prisma.tourDeparture.update({
    where: { id },
    data: {
      agenda: patch.agenda,
      meetingPoint: patch.meetingPoint,
      guideName: patch.guideName === undefined ? undefined : patch.guideName,
      vehicleId,
      pickupAt,
      returnAt,
      capacity: patch.capacity,
      price: patch.price != null ? toDecimal(patch.price) : undefined,
      status: nextStatus,
    },
    include: { vehicle: true, template: true },
  });
}

async function postTourCharge(
  reservationId: string,
  departure: { agenda: string; date: Date; price: Parameters<typeof decimalToNumber>[0] },
) {
  const revenue = await tourRevenue();
  return postCharge({
    reservationId,
    revenueCodeId: revenue.id,
    amount: decimalToNumber(departure.price),
    description: `Tour: ${departure.agenda || departure.date.toISOString().slice(0, 10)}`,
  });
}

export async function addTourBooking(input: { departureId: string; reservationId: string; notes?: string }) {
  const policy = await getTourOpsPolicy();
  const departure = await prisma.tourDeparture.findUnique({
    where: { id: input.departureId },
    include: { vehicle: true, bookings: true },
  });
  if (!departure) throw new Error('Tour departure not found');
  if (['CANCELLED', 'DEPARTED', 'CLOSED'].includes(departure.status)) {
    throw new Error('Departure is not open for booking');
  }

  const reservation = await prisma.reservation.findUnique({
    where: { id: input.reservationId },
    include: { guest: true },
  });
  const allowedStatuses =
    policy.chargeMode === 'CHARGE_ON_ADD' ? ['IN_HOUSE'] : ['CONFIRMED', 'IN_HOUSE'];
  if (!reservation || !allowedStatuses.includes(reservation.status)) {
    throw new Error(
      policy.chargeMode === 'CHARGE_ON_ADD'
        ? 'Guest must be IN_HOUSE'
        : 'Guest must be CONFIRMED or IN_HOUSE',
    );
  }

  const cap = seatCap(departure);
  const live = countLive(departure.bookings);
  if (!policy.allowOverbook && live >= cap) throw new Error('Tour is full');
  if (policy.chargeMode === 'CHARGE_ON_ADD' && live >= cap) throw new Error('Tour is full');

  const dup = departure.bookings.find(
    (b) => b.reservationId === input.reservationId && b.status !== 'CANCELLED',
  );
  if (dup) throw new Error('Guest is already on this departure');

  if (policy.chargeMode === 'CHARGE_ON_ADD') {
    const charge = await postTourCharge(reservation.id, departure);
    return prisma.tourBooking.create({
      data: {
        departureId: departure.id,
        reservationId: reservation.id,
        guestId: reservation.guestId,
        folioChargeId: charge.id,
        status: 'CHARGED',
        notes: input.notes,
      },
      include: { reservation: { include: { guest: true, room: true } } },
    });
  }

  return prisma.tourBooking.create({
    data: {
      departureId: departure.id,
      reservationId: reservation.id,
      guestId: reservation.guestId,
      status: 'RESERVED',
      notes: input.notes,
    },
    include: { reservation: { include: { guest: true, room: true } } },
  });
}

export async function markTourBoarded(bookingId: string) {
  const booking = await prisma.tourBooking.findUnique({
    where: { id: bookingId },
    include: {
      departure: { include: { vehicle: true, bookings: true } },
      reservation: true,
    },
  });
  if (!booking) throw new Error('Tour booking not found');
  if (booking.status === 'CANCELLED') throw new Error('Cannot board a cancelled booking');
  if (BOARDED_STATUSES.includes(booking.status)) return booking;
  if (booking.status !== 'RESERVED') throw new Error('Booking is not awaiting boarding');
  if (booking.reservation.status !== 'IN_HOUSE') {
    throw new Error('Guest must be IN_HOUSE to board');
  }

  const cap = seatCap(booking.departure);
  if (countBoarded(booking.departure.bookings) >= cap) {
    throw new Error('Tour boarding capacity is full');
  }

  const charge = await postTourCharge(booking.reservationId, booking.departure);
  return prisma.tourBooking.update({
    where: { id: bookingId },
    data: { status: 'CHARGED', folioChargeId: charge.id },
    include: { reservation: { include: { guest: true, room: true } } },
  });
}

export async function closeTourBoarding(departureId: string, boardedBookingIds: string[]) {
  const policy = await getTourOpsPolicy();
  const departure = await prisma.tourDeparture.findUnique({
    where: { id: departureId },
    include: { vehicle: true, bookings: true },
  });
  if (!departure) throw new Error('Tour departure not found');
  if (['CANCELLED', 'DEPARTED'].includes(departure.status)) {
    throw new Error('Departure cannot close boarding');
  }

  const boardedSet = new Set(boardedBookingIds);
  const cap = seatCap(departure);
  const alreadyBoarded = countBoarded(departure.bookings);
  const toBoard = departure.bookings.filter(
    (b) => b.status === 'RESERVED' && boardedSet.has(b.id),
  );
  if (alreadyBoarded + toBoard.length > cap) {
    throw new Error('Tour boarding capacity is full');
  }

  const results = [];
  for (const b of toBoard) {
    results.push(await markTourBoarded(b.id));
  }

  if (policy.dropUnboardedOnClose) {
    const drop = departure.bookings.filter(
      (b) => b.status === 'RESERVED' && !boardedSet.has(b.id),
    );
    for (const b of drop) {
      await prisma.tourBooking.update({
        where: { id: b.id },
        data: { status: 'CANCELLED' },
      });
    }
  }

  await prisma.tourDeparture.update({
    where: { id: departureId },
    data: { status: 'CLOSED' },
  });

  return getTourDeparture(departureId);
}

/** Cancel / remove. Post-boarding cancel refunds money (void unpaid / refund paid). */
export async function removeTourBooking(id: string, reason?: string) {
  const booking = await prisma.tourBooking.findUnique({ where: { id } });
  if (!booking) throw new Error('Tour booking not found');
  if (booking.status === 'CANCELLED') return booking;

  const cancelReason = reason?.trim() || 'Tour booking cancelled';

  if (booking.status === 'RESERVED') {
    return prisma.tourBooking.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  if (booking.status === 'PAID') {
    if (!booking.folioPaymentId) {
      throw new Error('Paid tour booking has no payment to refund');
    }
    await refundFolioPayment({
      paymentId: booking.folioPaymentId,
      reason: cancelReason,
    });
    if (booking.folioChargeId) {
      await voidCharge(booking.folioChargeId, cancelReason);
    }
    return prisma.tourBooking.update({
      where: { id },
      data: { status: 'CANCELLED', folioChargeId: null, folioPaymentId: null },
    });
  }

  if (booking.status === 'ON_CITY_LEDGER') {
    if (booking.folioChargeId) {
      await voidCharge(booking.folioChargeId, cancelReason);
    }
    return prisma.tourBooking.update({
      where: { id },
      data: { status: 'CANCELLED', folioChargeId: null, folioPaymentId: null },
    });
  }

  if (booking.status === 'CHARGED' && booking.folioChargeId) {
    await voidCharge(booking.folioChargeId, cancelReason);
  }
  return prisma.tourBooking.update({
    where: { id },
    data: { status: 'CANCELLED', folioChargeId: null },
  });
}

export async function payFolioCharge(
  chargeId: string,
  paymentMethod: PaymentMethod,
  bankTerminalId?: string,
  createdByUserId?: string,
  auditRequest?: Request,
) {
  const charge = await prisma.folioCharge.findUnique({
    where: { id: chargeId },
    include: { folio: true, revenueCode: true },
  });
  if (!charge) throw new Error('Charge not found');
  if (charge.folio.type !== 'GUEST') throw new Error('Line pay is only allowed on GUEST folios');
  if (charge.folio.status !== 'OPEN') throw new Error('Folio is not open');

  const amount = decimalToNumber(charge.amount) * charge.qty;
  const payment = await postPayment({
    folioId: charge.folioId,
    amount,
    paymentMethod,
    bankTerminalId:
      paymentMethod === 'CARD' || paymentMethod.startsWith('CARD_') ? bankTerminalId : undefined,
    createdByUserId,
    auditRequest,
  });
  await prisma.folioPaymentAllocation.create({
    data: { paymentId: payment.id, chargeId: charge.id, amount: toDecimal(amount) },
  });

  const booking = await prisma.tourBooking.findFirst({
    where: { folioChargeId: charge.id, status: 'CHARGED' },
  });
  if (booking) {
    await prisma.tourBooking.update({
      where: { id: booking.id },
      data: { status: 'PAID', folioPaymentId: payment.id },
    });
  }
  return payment;
}

export async function payTourBooking(
  id: string,
  paymentMethod: PaymentMethod,
  createdByUserId?: string,
  auditRequest?: Request,
  bankTerminalId?: string,
) {
  const booking = await prisma.tourBooking.findUnique({ where: { id } });
  if (!booking) throw new Error('Tour booking not found');
  if (booking.status === 'PAID') throw new Error('Tour booking already paid');
  if (booking.status !== 'CHARGED' || !booking.folioChargeId) {
    throw new Error('Tour booking is not awaiting payment');
  }
  return payFolioCharge(
    booking.folioChargeId,
    paymentMethod,
    bankTerminalId,
    createdByUserId,
    auditRequest,
  );
}

export async function syncTourBookingsAfterFolioSettle(folioId: string, usedGuestTender: boolean) {
  const folio = await prisma.folio.findUnique({
    where: { id: folioId },
    include: { charges: true, payments: true },
  });
  if (!folio || folio.type !== 'GUEST') return;
  const balance = folioBalance(folio.charges, folio.payments);
  if (Math.abs(balance) > 0.01) return;

  const next: TourBookingStatus = usedGuestTender ? 'PAID' : 'ON_CITY_LEDGER';
  await prisma.tourBooking.updateMany({
    where: { reservationId: folio.reservationId, status: 'CHARGED' },
    data: { status: next },
  });
}

export function usedGuestTender(methods: PaymentMethod[]) {
  return methods.some((m) => m !== 'COMPANY_ACCOUNT');
}

export async function getTourManifestPrint(id: string) {
  return getTourDeparture(id);
}

/** Eligible stays for tour roster autocomplete. */
export async function listEligibleStaysForTour() {
  const policy = await getTourOpsPolicy();
  const statuses =
    policy.chargeMode === 'CHARGE_ON_ADD' ? (['IN_HOUSE'] as const) : (['CONFIRMED', 'IN_HOUSE'] as const);
  return prisma.reservation.findMany({
    where: { status: { in: [...statuses] } },
    include: { guest: true, room: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
}

/** @deprecated use listEligibleStaysForTour */
export async function listInHouseForTour() {
  return listEligibleStaysForTour();
}
