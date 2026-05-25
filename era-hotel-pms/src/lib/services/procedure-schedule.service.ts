import { prisma } from '@/lib/prisma';
import { decimalToNumber } from '@/lib/decimal';
import { postCharge } from '@/lib/services/folio.service';
import { isProcedureIncludedInPackage } from '@/lib/services/san-package.service';

function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export async function listProcedureServices() {
  return prisma.procedureService.findMany({ orderBy: { code: 'asc' } });
}

export async function listAppointments(filters?: {
  from?: Date;
  to?: Date;
  reservationId?: string;
  status?: string;
}) {
  const where: Record<string, unknown> = {};
  if (filters?.reservationId) where.reservationId = filters.reservationId;
  if (filters?.status) where.status = filters.status;
  if (filters?.from || filters?.to) {
    where.startAt = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    };
  }

  return prisma.procedureAppointment.findMany({
    where,
    include: {
      service: true,
      reservation: { include: { guest: true, room: true, ratePlan: true } },
    },
    orderBy: { startAt: 'asc' },
  });
}

export async function assertNoConflict(input: {
  staffName?: string | null;
  placeCode?: string | null;
  startAt: Date;
  endAt: Date;
  excludeId?: string;
}) {
  if (input.endAt <= input.startAt) {
    throw new Error('End time must be after start time');
  }

  const overlapping = await prisma.procedureAppointment.findMany({
    where: {
      status: 'BOOKED',
      ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
      startAt: { lt: input.endAt },
      endAt: { gt: input.startAt },
    },
  });

  for (const row of overlapping) {
    if (
      input.staffName &&
      row.staffName === input.staffName &&
      rangesOverlap(input.startAt, input.endAt, row.startAt, row.endAt)
    ) {
      throw new Error(`Staff ${input.staffName} already booked for this slot`);
    }
    if (
      input.placeCode &&
      row.placeCode === input.placeCode &&
      rangesOverlap(input.startAt, input.endAt, row.startAt, row.endAt)
    ) {
      throw new Error(`Place ${input.placeCode} already booked for this slot`);
    }
  }
}

export async function createAppointment(input: {
  reservationId: string;
  serviceId: string;
  staffName?: string;
  placeCode?: string;
  startAt: Date;
  endAt: Date;
}) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: input.reservationId },
  });
  if (!reservation || !['CONFIRMED', 'IN_HOUSE'].includes(reservation.status)) {
    throw new Error('Reservation must be CONFIRMED or IN_HOUSE');
  }

  await assertNoConflict(input);

  return prisma.procedureAppointment.create({
    data: input,
    include: {
      service: true,
      reservation: { include: { guest: true, room: true } },
    },
  });
}

export async function finishAppointment(id: string, auditNote?: string) {
  const appt = await prisma.procedureAppointment.findUnique({
    where: { id },
    include: { service: true, reservation: true },
  });
  if (!appt) throw new Error('Appointment not found');
  if (appt.status !== 'BOOKED') throw new Error('Only BOOKED appointments can be finished');

  const included = await isProcedureIncludedInPackage(appt.reservationId, appt.serviceId);
  let folioChargeId: string | null = null;

  if (!included) {
    const medicalCode = await prisma.revenueCode.findUnique({ where: { code: 'MEDICAL' } });
    if (!medicalCode) throw new Error('Revenue code MEDICAL not configured');
    const charge = await postCharge({
      reservationId: appt.reservationId,
      revenueCodeId: medicalCode.id,
      amount: decimalToNumber(appt.service.defaultAmount),
      description: `Extra procedure: ${appt.service.name}`,
      businessDate: new Date(),
    });
    folioChargeId = charge.id;
  }

  const updated = await prisma.procedureAppointment.update({
    where: { id },
    data: {
      status: 'FINISHED',
      auditNote: auditNote ?? (included ? 'Included in package (audit only)' : 'Extra charge posted'),
    },
    include: {
      service: true,
      reservation: { include: { guest: true, room: true, ratePlan: true } },
    },
  });

  return { appointment: updated, includedInPackage: included, folioChargeId };
}

export async function markNoShow(id: string) {
  return prisma.procedureAppointment.update({
    where: { id },
    data: { status: 'NO_SHOW', auditNote: 'No-show' },
    include: { service: true, reservation: { include: { guest: true, room: true } } },
  });
}
