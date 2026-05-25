import { prisma } from '@/lib/prisma';
import { decimalToNumber, toDecimal } from '@/lib/decimal';
import { createPosReservation } from '@/lib/services/pos.service';
import { postPayment } from '@/lib/services/folio.service';

function eventDayBounds(eventDate: Date) {
  const start = new Date(eventDate);
  start.setHours(8, 0, 0, 0);
  const end = new Date(eventDate);
  end.setHours(23, 59, 59, 999);
  return { start, end };
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
    include: {
      saloon: { include: { posResource: true } },
      menuPackage: true,
      reservation: { include: { guest: true, room: true } },
    },
    orderBy: [{ eventDate: 'asc' }, { createdAt: 'desc' }],
  });
}

export async function getBanquetEvent(id: string) {
  const event = await prisma.banquetEvent.findUnique({
    where: { id },
    include: {
      saloon: { include: { posResource: true } },
      menuPackage: true,
      reservation: { include: { guest: true, room: true, folios: true } },
    },
  });
  if (!event) throw new Error('Banquet event not found');
  return event;
}

export async function createBanquetEvent(input: {
  eventName: string;
  saloonId: string;
  menuPackageId?: string;
  reservationId?: string;
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

  return prisma.banquetEvent.create({
    data: {
      eventName: input.eventName,
      saloonId: input.saloonId,
      menuPackageId: input.menuPackageId,
      reservationId: input.reservationId,
      eventDate: input.eventDate,
      pax: input.pax,
      advanceAmount: toDecimal(input.advanceAmount ?? 0),
      contactName: input.contactName,
      notes: input.notes,
      referenceNo: input.referenceNo,
    },
    include: {
      saloon: true,
      menuPackage: true,
      reservation: { include: { guest: true, room: true } },
    },
  });
}

export async function confirmBanquetEvent(id: string) {
  const event = await prisma.banquetEvent.findUnique({
    where: { id },
    include: {
      saloon: { include: { posResource: true } },
      menuPackage: true,
      reservation: { include: { folios: true, guest: true } },
    },
  });
  if (!event) throw new Error('Banquet event not found');
  if (event.status !== 'DRAFT') throw new Error('Only DRAFT events can be confirmed');

  let posReservationId = event.posReservationId;
  const resourceId = event.saloon.posResourceId;
  if (resourceId) {
    const { start, end } = eventDayBounds(event.eventDate);
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

  let depositPaymentId: string | null = null;
  const advance = decimalToNumber(event.advanceAmount);
  if (event.reservationId && advance > 0) {
    const folio =
      event.reservation?.folios.find((f) => f.type === 'GUEST' && f.status === 'OPEN') ??
      (await prisma.folio.findFirst({
        where: { reservationId: event.reservationId, type: 'GUEST', status: 'OPEN' },
      }));
    if (!folio) throw new Error('Open guest folio required to post deposit');
    const payment = await postPayment({
      folioId: folio.id,
      amount: advance,
      paymentMethod: event.reservation!.paymentMethod,
      registerRef: `BEO-${event.referenceNo ?? event.id}`,
    });
    depositPaymentId = payment.id;
  }

  const updated = await prisma.banquetEvent.update({
    where: { id },
    data: { status: 'CONFIRMED', posReservationId },
    include: {
      saloon: { include: { posResource: true } },
      menuPackage: true,
      reservation: { include: { guest: true, room: true } },
    },
  });

  return { event: updated, depositPaymentId, posReservationId };
}
