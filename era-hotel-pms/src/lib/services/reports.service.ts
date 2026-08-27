import { prisma } from '@/lib/prisma';
import { decimalToNumber } from '@/lib/decimal';

function dateOnly(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function listInhouseDaily(date: Date) {
  const day = dateOnly(date);
  const next = new Date(day);
  next.setDate(next.getDate() + 1);

  const inHouse = await prisma.reservation.findMany({
    where: { status: 'IN_HOUSE' },
    include: { guest: true, room: true, roomType: true, agency: true },
    orderBy: [{ room: { roomNumber: 'asc' } }, { checkInDate: 'asc' }],
  });

  const departures = await prisma.reservation.findMany({
    where: {
      status: { in: ['IN_HOUSE', 'CONFIRMED'] },
      checkOutDate: { gte: day, lt: next },
    },
    include: { guest: true, room: true, roomType: true, agency: true },
  });

  return { date: day, inHouse, departures };
}

export async function listReservationNotesReport() {
  const reservations = await prisma.reservation.findMany({
    include: {
      guest: true,
      room: true,
      roomType: true,
      agency: true,
      notes: true,
    },
    orderBy: { checkInDate: 'desc' },
    take: 500,
  });

  return reservations
    .filter((r) => r.notes.some((n) => n.text.trim()))
    .map((r) => ({
      id: r.id,
      status: r.status,
      checkInDate: r.checkInDate,
      checkOutDate: r.checkOutDate,
      guest: r.guest,
      room: r.room,
      roomType: r.roomType,
      agency: r.agency,
      notesSummary: r.notes.map((n) => `${n.noteType}: ${n.text}`).join(' · '),
    }));
}

export async function listReservationTimes(from: Date, to: Date) {
  return prisma.reservation.findMany({
    where: {
      checkInDate: { lte: to },
      checkOutDate: { gte: from },
    },
    include: {
      guest: true,
      room: true,
      stay: true,
    },
    orderBy: { checkInDate: 'asc' },
    take: 500,
  });
}

export async function listRoomChangePlans() {
  return prisma.roomChangePlan.findMany({
    include: {
      reservation: { include: { guest: true } },
      fromRoom: true,
      toRoom: true,
    },
    orderBy: { effectiveAt: 'desc' },
    take: 200,
  });
}

export async function createRoomChangePlan(input: {
  reservationId: string;
  fromRoomId?: string;
  toRoomId?: string;
  effectiveAt: Date;
  notes?: string;
}) {
  return prisma.roomChangePlan.create({
    data: {
      reservationId: input.reservationId,
      fromRoomId: input.fromRoomId,
      toRoomId: input.toRoomId,
      effectiveAt: input.effectiveAt,
      notes: input.notes,
      status: 'PENDING',
      kind: 'SCHEDULED',
    },
    include: { fromRoom: true, toRoom: true, reservation: { include: { guest: true } } },
  });
}

export async function listNightAuditRunsReport(limit = 100) {
  return prisma.nightAuditRun.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { businessDay: true },
  });
}

export async function listGroupReservationsWithBalance() {
  const groups = await prisma.reservationGroup.findMany({
    include: {
      agency: true,
      reservations: {
        include: {
          guest: true,
          folios: { include: { charges: true, payments: true } },
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: 200,
  });

  return groups.map((g) => {
    let balance = 0;
    for (const r of g.reservations) {
      for (const f of r.folios) {
        const ch = f.charges.reduce((s, c) => s + decimalToNumber(c.amount) * c.qty, 0);
        const pay = f.payments.reduce((s, p) => s + decimalToNumber(p.amount), 0);
        balance += ch - pay;
      }
    }
    return { ...g, groupBalance: balance };
  });
}
