import { prisma } from '@/lib/prisma';

const PLAN_STATUSES = ['CONFIRMED', 'IN_HOUSE', 'OPTION'] as const;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dayKey(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Baku' }).format(d);
}

function nightsBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86400000);
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
      agency: true,
      source: true,
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

  const dateKeys: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    dateKeys.push(dayKey(d));
  }

  const occupiedByDay = new Map<string, Set<string>>();
  for (const dk of dateKeys) occupiedByDay.set(dk, new Set());

  for (const r of reservations) {
    if (!r.roomId) continue;
    const ci = startOfDay(r.checkInDate);
    const co = startOfDay(r.checkOutDate);
    for (let i = 0; i < days; i++) {
      const d = new Date(from);
      d.setDate(d.getDate() + i);
      if (d >= ci && d < co) {
        occupiedByDay.get(dayKey(d))?.add(r.roomId);
      }
    }
  }

  const totalRooms = rooms.length;
  const availabilityByDay: Record<string, number> = {};
  for (const dk of dateKeys) {
    const occ = occupiedByDay.get(dk)?.size ?? 0;
    availabilityByDay[dk] = Math.max(0, totalRooms - occ);
  }

  const byType = new Map<string, typeof rooms>();
  const byFloor = new Map<number, typeof rooms>();
  for (const room of rooms) {
    const tc = room.roomType.code;
    if (!byType.has(tc)) byType.set(tc, []);
    byType.get(tc)!.push(room);
    if (!byFloor.has(room.floor)) byFloor.set(room.floor, []);
    byFloor.get(room.floor)!.push(room);
  }

  function groupAvailability(roomList: typeof rooms): Record<string, number> {
    const out: Record<string, number> = {};
    for (const dk of dateKeys) out[dk] = roomList.length;
    for (const r of reservations) {
      if (!r.roomId || !roomList.some((x) => x.id === r.roomId)) continue;
      const ci = startOfDay(r.checkInDate);
      const co = startOfDay(r.checkOutDate);
      for (let i = 0; i < days; i++) {
        const d = new Date(from);
        d.setDate(d.getDate() + i);
        const dk = dayKey(d);
        if (d >= ci && d < co) out[dk] = Math.max(0, (out[dk] ?? roomList.length) - 1);
      }
    }
    return out;
  }

  const groups = {
    byType: Array.from(byType.entries()).map(([key, roomList]) => ({
      key,
      label: key,
      roomCount: roomList.length,
      rooms: roomList,
      availabilityByDay: groupAvailability(roomList),
    })),
    byFloor: Array.from(byFloor.entries())
      .sort(([a], [b]) => a - b)
      .map(([floor, roomList]) => ({
        key: String(floor),
        label: `Floor ${floor}`,
        roomCount: roomList.length,
        rooms: roomList,
        availabilityByDay: groupAvailability(roomList),
      })),
  };

  return {
    from: dayKey(from),
    days,
    to: to.toISOString(),
    rooms,
    reservations,
    unassigned,
    availabilityByDay,
    groups,
  };
}
