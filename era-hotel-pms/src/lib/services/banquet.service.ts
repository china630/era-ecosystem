import { prisma } from '@/lib/prisma';
import { decimalToNumber, toDecimal } from '@/lib/decimal';
import { createPosReservation } from '@/lib/services/pos.service';
import { postCharge, postPayment } from '@/lib/services/folio.service';
import {
  computeEventPlannedRevenue,
  eventInclude,
  refreshEventPlannedRevenue,
} from '@/lib/services/event-order.service';
import type { FolioType } from '@prisma/client';

function eventDayBounds(eventDate: Date) {
  const start = new Date(eventDate);
  start.setHours(8, 0, 0, 0);
  const end = new Date(eventDate);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

async function resolveMasterFolio(
  reservationId: string | null,
  preferred: FolioType[],
): Promise<{ id: string; type: FolioType } | null> {
  if (!reservationId) return null;
  for (const type of preferred) {
    const folio = await prisma.folio.findFirst({
      where: { reservationId, type, status: 'OPEN' },
    });
    if (folio) return { id: folio.id, type };
  }
  return null;
}

export async function listBanquetMeta() {
  const [saloons, menuPackages] = await Promise.all([
    prisma.banquetSaloon.findMany({
      where: { active: true },
      include: { posResource: true },
      orderBy: { code: 'asc' },
    }),
    prisma.banquetMenuPackage.findMany({
      where: { active: true },
      orderBy: { code: 'asc' },
    }),
  ]);
  return { saloons, menuPackages };
}

export async function listBanquetEvents(filters?: { status?: string; from?: Date; to?: Date }) {
  const where: Record<string, unknown> = {};
  if (filters?.status) where.status = filters.status;
  if (filters?.from || filters?.to) {
    where.eventDate = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    };
  }

  return prisma.banquetEvent.findMany({
    where,
    include: eventInclude,
    orderBy: [{ eventDate: 'asc' }, { createdAt: 'desc' }],
  });
}

export async function getBanquetEvent(id: string) {
  const event = await prisma.banquetEvent.findUnique({
    where: { id },
    include: eventInclude,
  });
  if (!event) throw new Error('Banquet event not found');
  return event;
}

export async function createBanquetEvent(input: {
  eventName: string;
  saloonId: string;
  menuPackageId?: string;
  reservationId?: string;
  salesContractId?: string;
  agencyId?: string;
  companyGuestId?: string;
  reservationGroupId?: string;
  eventDate: Date;
  pax: number;
  advanceAmount?: number;
  contactName?: string;
  notes?: string;
  referenceNo?: string;
}) {
  const saloon = await prisma.banquetSaloon.findUnique({ where: { id: input.saloonId } });
  if (!saloon || !saloon.active) throw new Error('Saloon not found');
  if (input.pax < 1) throw new Error('Pax must be at least 1');
  if (input.pax > saloon.maxPax) {
    throw new Error(`Pax exceeds saloon capacity (${saloon.maxPax})`);
  }

  if (input.menuPackageId) {
    const pkg = await prisma.banquetMenuPackage.findUnique({ where: { id: input.menuPackageId } });
    if (!pkg || !pkg.active) throw new Error('Menu package not found');
  }

  if (input.reservationId) {
    const reservation = await prisma.reservation.findUnique({ where: { id: input.reservationId } });
    if (!reservation || !['CONFIRMED', 'IN_HOUSE'].includes(reservation.status)) {
      throw new Error('Reservation must be CONFIRMED or IN_HOUSE');
    }
  }

  const created = await prisma.banquetEvent.create({
    data: {
      eventName: input.eventName,
      saloonId: input.saloonId,
      menuPackageId: input.menuPackageId,
      reservationId: input.reservationId,
      salesContractId: input.salesContractId,
      agencyId: input.agencyId,
      companyGuestId: input.companyGuestId,
      reservationGroupId: input.reservationGroupId,
      eventDate: input.eventDate,
      pax: input.pax,
      advanceAmount: toDecimal(input.advanceAmount ?? 0),
      contactName: input.contactName,
      notes: input.notes,
      referenceNo: input.referenceNo,
    },
    include: eventInclude,
  });

  await refreshEventPlannedRevenue(created.id);
  return getBanquetEvent(created.id);
}

export async function confirmBanquetEvent(id: string) {
  const event = await prisma.banquetEvent.findUnique({
    where: { id },
    include: eventInclude,
  });
  if (!event) throw new Error('Banquet event not found');
  if (event.status !== 'DRAFT') throw new Error('Only DRAFT events can be confirmed');

  const planned = computeEventPlannedRevenue(event);

  let posReservationId = event.posReservationId;
  const resourceId = event.saloon.posResourceId;
  const { start, end } = eventDayBounds(event.eventDate);

  if (resourceId) {
    const block = await createPosReservation({
      resourceId,
      startAt: start,
      endAt: end,
      partySize: event.pax,
      reservationId: event.reservationId ?? undefined,
      guestName: event.contactName ?? event.eventName,
      notes: `BEO ${event.referenceNo ?? event.id}`,
    });
    posReservationId = block.id;
  }

  await prisma.eventResourceBooking.create({
    data: {
      banquetEventId: event.id,
      saloonId: event.saloonId,
      posResourceId: resourceId ?? undefined,
      label: event.saloon.name,
      startAt: start,
      endAt: end,
      notes: 'Primary saloon block',
    },
  });

  let masterFolioId: string | null = event.masterFolioId;

  if (event.reservationId && planned > 0) {
    const banquetCode = await prisma.revenueCode.findFirst({
      where: { code: { in: ['BANQUET', 'FB', 'ROOM'] }, active: true },
      orderBy: { code: 'asc' },
    });
    if (banquetCode) {
      const charge = await postCharge({
        reservationId: event.reservationId,
        amount: planned,
        description: `BEO package ${event.eventName}`,
        revenueCodeId: banquetCode.id,
      });
      masterFolioId = charge.folio.id;
    }
  } else if (!masterFolioId && event.reservationId) {
    const master = await resolveMasterFolio(event.reservationId, ['COMPANY', 'AGENCY', 'GUEST']);
    masterFolioId = master?.id ?? null;
  }

  let depositPaymentId: string | null = null;
  const advance = decimalToNumber(event.advanceAmount);
  const depositFolioId = masterFolioId;
  if (event.reservationId && advance > 0 && depositFolioId) {
    const folio = await prisma.folio.findUnique({ where: { id: depositFolioId } });
    if (!folio) throw new Error('Master folio required to post deposit');
    const reservation = event.reservation!;
    const payment = await postPayment({
      folioId: folio.id,
      amount: advance,
      paymentMethod: reservation.paymentMethod,
      registerRef: `BEO-${event.referenceNo ?? event.id}`,
    });
    depositPaymentId = payment.id;
  }

  const updated = await prisma.banquetEvent.update({
    where: { id },
    data: {
      status: 'CONFIRMED',
      posReservationId,
      masterFolioId,
      plannedRevenue: toDecimal(planned),
      actualRevenue: toDecimal(planned),
    },
    include: eventInclude,
  });

  return { event: updated, depositPaymentId, posReservationId, masterFolioId, plannedRevenue: planned };
}

/** Record POS extras against event (fb-pos beoId tickets). Updates actual revenue. */
export async function recordEventPosExtra(banquetEventId: string, amount: number) {
  if (amount <= 0) throw new Error('Amount must be positive');
  const event = await prisma.banquetEvent.findUnique({ where: { id: banquetEventId } });
  if (!event) throw new Error('Banquet event not found');
  const nextActual = decimalToNumber(event.actualRevenue) + amount;
  return prisma.banquetEvent.update({
    where: { id: banquetEventId },
    data: { actualRevenue: toDecimal(nextActual) },
  });
}
