import { prisma } from '@/lib/prisma';

const PLAN_STATUSES = ['CONFIRMED', 'IN_HOUSE', 'OPTION'] as const;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function getRoomPlan(input?: { from?: Date; days?: number }) {
  const days = input?.days ?? 14;
  const from = startOfDay(input?.from ?? new Date());
  const to = new Date(from);
  to.setDate(to.getDate() + days);

  const rooms = await prisma.room.findMany({
    include: { roomType: true },
    orderBy: [{ floor: 'asc' }, { roomNumber: 'asc' }],
  });

  const reservations = await prisma.reservation.findMany({
    where: {
      status: { in: [...PLAN_STATUSES] },
      roomId: { not: null },
      checkInDate: { lt: to },
      checkOutDate: { gt: from },
    },
    include: {
      guest: true,
      roomType: true,
      room: true,
    },
    orderBy: { checkInDate: 'asc' },
  });

  const unassigned = await prisma.reservation.findMany({
    where: {
      status: { in: [...PLAN_STATUSES] },
      roomId: null,
      checkInDate: { lt: to },
      checkOutDate: { gt: from },
    },
    include: { guest: true, roomType: true },
    orderBy: { checkInDate: 'asc' },
  });

  return {
    from: from.toISOString(),
    days,
    to: to.toISOString(),
    rooms,
    reservations,
    unassigned,
  };
}
