import { prisma } from '@/lib/prisma';
import {
  addHotelDays,
  hotelDateKey,
  parseHotelNoon,
} from '@/lib/hotel-calendar';

const PLAN_STATUSES = ['CONFIRMED', 'IN_HOUSE', 'OPTION'] as const;

export async function getRoomPlan(input?: { from?: Date; days?: number }) {
  const days = input?.days ?? 14;
  const fromKey = hotelDateKey(input?.from ?? new Date());
  const from = parseHotelNoon(fromKey);
  const to = parseHotelNoon(addHotelDays(fromKey, days));

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
    dateKeys.push(addHotelDays(fromKey, i));
  }

  const occupiedByDay = new Map<string, Set<string>>();
  for (const dk of dateKeys) occupiedByDay.set(dk, new Set());

  for (const r of reservations) {
    if (!r.roomId) continue;
    const ciKey = hotelDateKey(r.checkInDate);
    const coKey = hotelDateKey(r.checkOutDate);
    for (const dk of dateKeys) {
      if (dk >= ciKey && dk < coKey) {
        occupiedByDay.get(dk)?.add(r.roomId);
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
      const ciKey = hotelDateKey(r.checkInDate);
      const coKey = hotelDateKey(r.checkOutDate);
      for (const dk of dateKeys) {
        if (dk >= ciKey && dk < coKey) {
          out[dk] = Math.max(0, (out[dk] ?? roomList.length) - 1);
        }
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
    from: fromKey,
    days,
    to: to.toISOString(),
    rooms,
    reservations,
    unassigned,
    availabilityByDay,
    groups,
  };
}
