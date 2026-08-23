import type { PaymentMethod, TourBookingStatus, TourDepartureStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { decimalToNumber, toDecimal } from '@/lib/decimal';
import { satelliteOrganizationId } from '@era/satellite-kit/orchestrator-gateway';
import { folioBalance, postCharge, postPayment, voidCharge } from '@/lib/services/folio.service';

export const TRANSFER_OCCUPANCY_MS = 90 * 60 * 1000;

export class TourConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TourConflictError';
  }
}

async function tourRevenue() {
  const code = await prisma.revenueCode.findFirst({ where: { code: 'TOUR' } });
  if (!code) throw new Error('Revenue code TOUR is not configured');
  return code;
}

function orgId() {
  return satelliteOrganizationId();
}

function seatCap(departure: { capacity: number; vehicle: { maxSeats: number } | null }) {
  if (!departure.vehicle) return departure.capacity;
  return Math.min(departure.capacity, departure.vehicle.maxSeats);
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
      _count: { select: { bookings: { where: { status: { in: ['CHARGED', 'PAID'] } } } } },
    },
    orderBy: [{ date: 'asc' }, { pickupAt: 'asc' }],
  });
}

export async function getTourDeparture(id: string) {
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
    const live = current.bookings.filter((b) => b.status === 'CHARGED' || b.status === 'PAID').length;
    const cap = Math.min(patch.capacity ?? current.capacity, v.maxSeats);
    if (live > cap) throw new Error('Vehicle seat count is below current roster');
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

export async function addTourBooking(input: { departureId: string; reservationId: string; notes?: string }) {
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
  if (!reservation || reservation.status !== 'IN_HOUSE') {
    throw new Error('Guest must be IN_HOUSE');
  }

  const live = departure.bookings.filter((b) => b.status === 'CHARGED' || b.status === 'PAID').length;
  if (live >= seatCap(departure)) throw new Error('Tour is full');

  const dup = departure.bookings.find(
    (b) => b.reservationId === input.reservationId && b.status !== 'CANCELLED',
  );
  if (dup) throw new Error('Guest is already on this departure');

  const revenue = await tourRevenue();
  const charge = await postCharge({
    reservationId: reservation.id,
    revenueCodeId: revenue.id,
    amount: decimalToNumber(departure.price),
    description: `Tour: ${departure.agenda || departure.date.toISOString().slice(0, 10)}`,
  });

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

export async function removeTourBooking(id: string) {
  const booking = await prisma.tourBooking.findUnique({ where: { id } });
  if (!booking) throw new Error('Tour booking not found');
  if (booking.status === 'PAID') throw new Error('Cannot remove a paid tour booking');
  if (booking.status === 'CANCELLED') return booking;
  if (booking.folioChargeId) {
    await voidCharge(booking.folioChargeId);
  }
  return prisma.tourBooking.update({
    where: { id },
    data: { status: 'CANCELLED', folioChargeId: null },
  });
}

export async function payFolioCharge(chargeId: string, paymentMethod: PaymentMethod) {
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

export async function payTourBooking(id: string, paymentMethod: PaymentMethod) {
  const booking = await prisma.tourBooking.findUnique({ where: { id } });
  if (!booking) throw new Error('Tour booking not found');
  if (booking.status === 'PAID') throw new Error('Tour booking already paid');
  if (booking.status !== 'CHARGED' || !booking.folioChargeId) {
    throw new Error('Tour booking is not awaiting payment');
  }
  return payFolioCharge(booking.folioChargeId, paymentMethod);
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


export async function listInHouseForTour() {
  return prisma.reservation.findMany({
    where: { status: 'IN_HOUSE' },
    include: { guest: true, room: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
}
