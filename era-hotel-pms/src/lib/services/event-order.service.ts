import { prisma } from '@/lib/prisma';
import { decimalToNumber, toDecimal } from '@/lib/decimal';
import type { EventStaffAssignmentStatus } from '@prisma/client';

const eventInclude = {
  saloon: { include: { posResource: true } },
  menuPackage: true,
  reservation: { include: { guest: true, room: true, folios: true } },
  salesContract: true,
  agency: true,
  companyGuest: true,
  orderLines: { include: { revenueCode: true } },
  resourceBookings: { include: { saloon: true, posResource: true } },
  staffAssignments: true,
} as const;

export function computeEventPlannedRevenue(event: {
  pax: number;
  menuPackage: { pricePerPax: Parameters<typeof decimalToNumber>[0] } | null;
  orderLines: Array<{
    quantity: Parameters<typeof decimalToNumber>[0];
    unitPrice: Parameters<typeof decimalToNumber>[0];
  }>;
}): number {
  let total = 0;
  if (event.menuPackage) {
    total += decimalToNumber(event.menuPackage.pricePerPax) * event.pax;
  }
  for (const line of event.orderLines) {
    total += decimalToNumber(line.quantity) * decimalToNumber(line.unitPrice);
  }
  return Math.round(total * 100) / 100;
}

export async function listEventOrderLines(banquetEventId: string) {
  return prisma.eventOrderLine.findMany({
    where: { banquetEventId },
    include: { revenueCode: true },
    orderBy: { createdAt: 'asc' },
  });
}

export async function addEventOrderLine(input: {
  banquetEventId: string;
  kind?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  revenueCodeId?: string;
  notes?: string;
}) {
  const event = await prisma.banquetEvent.findUnique({ where: { id: input.banquetEventId } });
  if (!event) throw new Error('Banquet event not found');
  if (event.status !== 'DRAFT') throw new Error('Order lines can only be added to DRAFT events');

  const line = await prisma.eventOrderLine.create({
    data: {
      banquetEventId: input.banquetEventId,
      kind: input.kind ?? 'OTHER',
      description: input.description,
      quantity: toDecimal(input.quantity),
      unitPrice: toDecimal(input.unitPrice),
      revenueCodeId: input.revenueCodeId,
      notes: input.notes,
    },
    include: { revenueCode: true },
  });

  await refreshEventPlannedRevenue(input.banquetEventId);
  return line;
}

export async function deleteEventOrderLine(id: string) {
  const line = await prisma.eventOrderLine.findUnique({ where: { id } });
  if (!line) throw new Error('Order line not found');
  await prisma.eventOrderLine.delete({ where: { id } });
  await refreshEventPlannedRevenue(line.banquetEventId);
}

export async function refreshEventPlannedRevenue(banquetEventId: string) {
  const event = await prisma.banquetEvent.findUnique({
    where: { id: banquetEventId },
    include: { menuPackage: true, orderLines: true },
  });
  if (!event) return;
  const planned = computeEventPlannedRevenue(event);
  await prisma.banquetEvent.update({
    where: { id: banquetEventId },
    data: { plannedRevenue: toDecimal(planned) },
  });
}

export async function listEventResourceBookings(filters?: { from?: Date; to?: Date; saloonId?: string }) {
  return prisma.eventResourceBooking.findMany({
    where: {
      ...(filters?.saloonId ? { saloonId: filters.saloonId } : {}),
      ...(filters?.from || filters?.to
        ? {
            startAt: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
    },
    include: {
      banquetEvent: { select: { id: true, eventName: true, status: true, pax: true } },
      saloon: true,
      posResource: true,
    },
    orderBy: { startAt: 'asc' },
  });
}

export async function addEventResourceBooking(input: {
  banquetEventId: string;
  saloonId?: string;
  posResourceId?: string;
  label?: string;
  startAt: Date;
  endAt: Date;
  notes?: string;
}) {
  if (!input.saloonId && !input.posResourceId) {
    throw new Error('saloonId or posResourceId is required');
  }
  return prisma.eventResourceBooking.create({
    data: input,
    include: { saloon: true, posResource: true },
  });
}

export async function deleteEventResourceBooking(id: string) {
  return prisma.eventResourceBooking.delete({ where: { id } });
}

export async function listEventStaffAssignments(banquetEventId: string) {
  return prisma.eventStaffAssignment.findMany({
    where: { banquetEventId },
    orderBy: [{ shiftStart: 'asc' }, { staffName: 'asc' }],
  });
}

export async function upsertEventStaffAssignment(input: {
  id?: string;
  banquetEventId: string;
  role: string;
  staffName: string;
  shiftStart?: Date;
  shiftEnd?: Date;
  status?: EventStaffAssignmentStatus;
  notes?: string;
}) {
  if (input.id) {
    return prisma.eventStaffAssignment.update({
      where: { id: input.id },
      data: {
        role: input.role,
        staffName: input.staffName,
        shiftStart: input.shiftStart,
        shiftEnd: input.shiftEnd,
        status: input.status,
        notes: input.notes,
      },
    });
  }
  return prisma.eventStaffAssignment.create({ data: input });
}

export async function deleteEventStaffAssignment(id: string) {
  return prisma.eventStaffAssignment.delete({ where: { id } });
}

export async function getEventSettlement(banquetEventId: string) {
  const event = await prisma.banquetEvent.findUnique({
    where: { id: banquetEventId },
    include: eventInclude,
  });
  if (!event) throw new Error('Banquet event not found');

  const planned = decimalToNumber(event.plannedRevenue);
  const actual = decimalToNumber(event.actualRevenue);
  const variance = Math.round((actual - planned) * 100) / 100;
  const marginPercent = planned > 0 ? Math.round((variance / planned) * 10000) / 100 : null;

  return {
    eventId: event.id,
    eventName: event.eventName,
    status: event.status,
    plannedRevenue: planned,
    actualRevenue: actual,
    variance,
    marginPercent,
    masterFolioId: event.masterFolioId,
    lineCount: event.orderLines.length,
    packagePaxTotal: event.menuPackage
      ? decimalToNumber(event.menuPackage.pricePerPax) * event.pax
      : 0,
    extrasPolicy: 'POS_EXTRAS_ONLY',
  };
}

export async function getEventProfitabilityReport(from?: Date, to?: Date) {
  const where: Record<string, unknown> = {};
  if (from || to) {
    where.eventDate = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }

  const events = await prisma.banquetEvent.findMany({
    where,
    include: {
      saloon: true,
      menuPackage: true,
      orderLines: true,
      agency: true,
      companyGuest: true,
    },
    orderBy: { eventDate: 'desc' },
  });

  return events.map((ev) => {
    const planned = decimalToNumber(ev.plannedRevenue);
    const actual = decimalToNumber(ev.actualRevenue);
    return {
      id: ev.id,
      eventName: ev.eventName,
      eventDate: ev.eventDate,
      saloon: ev.saloon.name,
      pax: ev.pax,
      status: ev.status,
      plannedRevenue: planned,
      actualRevenue: actual,
      variance: Math.round((actual - planned) * 100) / 100,
      counterparty: ev.companyGuest?.fullName ?? ev.agency?.name ?? ev.contactName ?? null,
    };
  });
}

export { eventInclude };
