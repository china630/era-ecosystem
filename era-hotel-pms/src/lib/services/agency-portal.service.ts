import { prisma } from '@/lib/prisma';
import { satelliteOrganizationId } from '@era/satellite-kit';
import { createReservation } from '@/lib/services/reservation.service';
import { getAvailabilityWithContractAllotment } from '@/lib/services/contract-allotment.service';
import { getHotelPolicy } from '@/lib/services/hotel-policy.service';
import { quoteReservationStay } from '@/lib/services/pricing-quote.service';

async function ensureAgencyBookingSource() {
  const existing = await prisma.bookingSource.findFirst({
    where: { OR: [{ code: 'AGENCY' }, { code: 'PORTAL' }] },
  });
  if (existing) return existing;
  return prisma.bookingSource.create({
    data: {
      organizationId: satelliteOrganizationId(),
      code: 'AGENCY',
      name: 'Travel Agency Portal',
    },
  });
}

export async function listAgencyContracts(agencyId: string) {
  return prisma.salesContract.findMany({
    where: {
      agencyId,
      status: 'ACTIVE',
      counterpartyType: 'AGENCY',
    },
    include: {
      ratePlan: true,
      allotments: { include: { roomType: true } },
    },
    orderBy: { code: 'asc' },
  });
}

export async function agencyQuoteAvailability(input: {
  agencyId: string;
  salesContractId: string;
  roomTypeId: string;
  checkInDate: Date;
  checkOutDate: Date;
}) {
  const contract = await prisma.salesContract.findFirst({
    where: {
      id: input.salesContractId,
      agencyId: input.agencyId,
      status: 'ACTIVE',
    },
  });
  if (!contract) {
    throw Object.assign(new Error('Contract not found for agency'), { status: 404 });
  }
  const avail = await getAvailabilityWithContractAllotment(
    input.roomTypeId,
    input.checkInDate,
    input.checkOutDate,
    input.salesContractId,
  );
  let quote = null;
  try {
    quote = await quoteReservationStay({
      ratePlanId: contract.ratePlanId,
      roomTypeId: input.roomTypeId,
      checkInDate: input.checkInDate,
      checkOutDate: input.checkOutDate,
      agencyId: input.agencyId,
    });
  } catch {
    quote = null;
  }
  return { contract, availability: avail, quote };
}

export async function createAgencyPortalReservation(input: {
  agencyId: string;
  salesContractId: string;
  roomTypeId: string;
  checkInDate: Date;
  checkOutDate: Date;
  guest: { fullName: string; phone?: string; email?: string; nationality?: string };
  adults?: number;
  children11_6?: number;
  children5_2?: number;
  children1_0?: number;
  bookerEmail?: string;
  externalRef?: string;
  paymentMethod?: 'COMPANY_ACCOUNT' | 'CASH' | 'CARD';
}) {
  const contract = await prisma.salesContract.findFirst({
    where: {
      id: input.salesContractId,
      agencyId: input.agencyId,
      status: 'ACTIVE',
    },
  });
  if (!contract) {
    throw Object.assign(new Error('Contract not found for agency'), { status: 404 });
  }

  const agency = await prisma.agency.findUnique({ where: { id: input.agencyId } });
  if (!agency?.active) {
    throw Object.assign(new Error('Agency inactive'), { status: 403 });
  }

  if (input.externalRef) {
    const dup = await prisma.reservation.findFirst({
      where: { externalRef: input.externalRef, agencyId: input.agencyId },
    });
    if (dup) {
      throw Object.assign(new Error('Duplicate externalRef'), { status: 409, reservationId: dup.id });
    }
  }

  const avail = await getAvailabilityWithContractAllotment(
    input.roomTypeId,
    input.checkInDate,
    input.checkOutDate,
    input.salesContractId,
  );
  if (avail.available < 1) {
    throw Object.assign(new Error('No contract allotment available'), { status: 409 });
  }

  const policy = await getHotelPolicy();
  const status = policy.agencyPortalAutoConfirm ? 'CONFIRMED' : 'OPTION';

  const guest = await prisma.guest.create({
    data: {
      organizationId: satelliteOrganizationId(),
      fullName: input.guest.fullName.trim(),
      phone: input.guest.phone?.trim() || null,
      email: input.guest.email?.trim() || null,
      nationality: input.guest.nationality?.trim() || 'AZ',
    },
  });

  const source = await ensureAgencyBookingSource();

  try {
    return await createReservation({
      roomTypeId: input.roomTypeId,
      guestId: guest.id,
      ratePlanId: contract.ratePlanId,
      salesContractId: contract.id,
      agencyId: input.agencyId,
      sourceId: source.id,
      checkInDate: input.checkInDate,
      checkOutDate: input.checkOutDate,
      paymentMethod: input.paymentMethod ?? 'COMPANY_ACCOUNT',
      adults: input.adults ?? 1,
      children11_6: input.children11_6 ?? 0,
      children5_2: input.children5_2 ?? 0,
      children1_0: input.children1_0 ?? 0,
      booker: input.bookerEmail,
      status,
      externalRef: input.externalRef,
    });
  } catch (err) {
    await prisma.guest.delete({ where: { id: guest.id } }).catch(() => null);
    throw err;
  }
}

export async function listAgencyOwnReservations(agencyId: string) {
  return prisma.reservation.findMany({
    where: { agencyId },
    include: {
      roomType: true,
      guest: true,
      ratePlan: true,
      salesContract: true,
    },
    orderBy: { checkInDate: 'desc' },
    take: 100,
  });
}

export async function listAgencyInbox() {
  return prisma.reservation.findMany({
    where: {
      status: 'OPTION',
      agencyId: { not: null },
      OR: [
        { source: { code: { in: ['AGENCY', 'PORTAL', 'AGENT', 'TRAVEL'] } } },
        { salesContractId: { not: null } },
      ],
    },
    include: {
      agency: true,
      roomType: true,
      guest: true,
      salesContract: true,
      source: true,
    },
    orderBy: { createdAt: 'asc' },
    take: 200,
  });
}

export async function confirmAgencyInboxItem(reservationId: string) {
  const row = await prisma.reservation.findUnique({ where: { id: reservationId } });
  if (!row || row.status !== 'OPTION' || !row.agencyId) {
    throw Object.assign(new Error('Not an agency OPTION reservation'), { status: 400 });
  }
  return prisma.reservation.update({
    where: { id: reservationId },
    data: { status: 'CONFIRMED' },
    include: { agency: true, guest: true, roomType: true },
  });
}

export async function declineAgencyInboxItem(reservationId: string, reason?: string) {
  const row = await prisma.reservation.findUnique({ where: { id: reservationId } });
  if (!row || row.status !== 'OPTION' || !row.agencyId) {
    throw Object.assign(new Error('Not an agency OPTION reservation'), { status: 400 });
  }
  if (reason?.trim()) {
    await prisma.reservationNote.upsert({
      where: {
        reservationId_noteType: {
          reservationId,
          noteType: 'AGENCY_DECLINE',
        },
      },
      create: {
        reservationId,
        noteType: 'AGENCY_DECLINE',
        text: reason.trim(),
      },
      update: { text: reason.trim() },
    });
  }
  return prisma.reservation.update({
    where: { id: reservationId },
    data: { status: 'CANCELLED' },
    include: { agency: true, guest: true, roomType: true },
  });
}
