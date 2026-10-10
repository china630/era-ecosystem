import { prisma } from '@/lib/prisma';
import { decimalToNumber } from '@/lib/decimal';
import { folioBalance } from '@/lib/services/folio.service';
import {
  addHotelDays,
  hotelDateKey,
  parseHotelNoon,
} from '@/lib/hotel-calendar';
import { normalizeShareGender } from '@/lib/share-gender';
import { roomPlanSpans } from '@/lib/services/room-plan-spans';

/** Active stays on the plan; CHECKED_OUT included so EW gold checkout bars appear. */
export const PLAN_STATUSES = ['CONFIRMED', 'IN_HOUSE', 'OPTION', 'CHECKED_OUT'] as const;
export const UNASSIGNED_STATUSES = ['CONFIRMED', 'IN_HOUSE', 'OPTION'] as const;

export async function getRoomPlan(input?: { from?: Date; days?: number }) {
  const days = input?.days ?? 14;
  const fromKey = hotelDateKey(input?.from ?? new Date());
  const from = parseHotelNoon(fromKey);
  const to = parseHotelNoon(addHotelDays(fromKey, days));

  const rooms = await prisma.room.findMany({
    where: {
      NOT: {
        OR: [
          { status: { in: ['OOO', 'OOS', 'MAINTENANCE'] } },
          { inventoryStatus: { in: ['OOO', 'OOS'] } },
        ],
      },
    },
    include: { roomType: true },
    orderBy: [{ floor: 'asc' }, { roomNumber: 'asc' }],
  });

  const reservations = await prisma.reservation.findMany({
    where: {
      status: { in: [...PLAN_STATUSES] },
      checkInDate: { lt: to },
      // gte: include same-noon departures on the window start day (EW departure / checkout bars).
      checkOutDate: { gte: from },
      OR: [{ roomId: { not: null } }, { staySlices: { some: { roomId: { not: null } } } }],
    },
    include: {
      guest: { select: { fullName: true } },
      paxGuests: {
        select: { firstName: true, lastName: true, isPrimary: true, sortOrder: true },
        orderBy: { sortOrder: 'asc' },
      },
      roomType: { select: { code: true } },
      room: { select: { roomNumber: true } },
      agency: { select: { name: true } },
      source: { select: { name: true, code: true } },
      mealPlan: { select: { code: true } },
      notes: { select: { noteType: true, text: true } },
      staySlices: {
        select: {
          id: true,
          fromDate: true,
          toDate: true,
          roomId: true,
          roomType: { select: { code: true } },
        },
      },
      folios: {
        select: {
          type: true,
          charges: { select: { amount: true, qty: true } },
          payments: { select: { amount: true, kind: true } },
        },
      },
    },
    orderBy: { checkInDate: 'asc' },
  });

  const unassigned = await prisma.reservation.findMany({
    where: {
      status: { in: [...UNASSIGNED_STATUSES] },
      roomId: null,
      staySlices: { none: { roomId: { not: null } } },
      checkInDate: { lt: to },
      checkOutDate: { gte: from },
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

  function pickNote(notes: Array<{ noteType: string; text: string }>, voucherNo: string | null) {
    const preferred =
      notes.find((n) => n.noteType === 'RES_NOTE' && n.text.trim()) ??
      notes.find((n) => n.text.trim());
    const text = preferred?.text.trim() || '';
    if (voucherNo && text) return text.includes(voucherNo) ? text : `${voucherNo} · ${text}`;
    return text || voucherNo || null;
  }

  function mapBar(r: (typeof reservations)[number]) {
    const nights = Math.max(
      1,
      Math.round(
        (r.checkOutDate.getTime() - r.checkInDate.getTime()) / (1000 * 60 * 60 * 24),
      ),
    );
    const total = decimalToNumber(r.totalAmount);
    const guestFolios = r.folios.filter((f) => f.type === 'GUEST');
    const agencyFolios = r.folios.filter((f) => f.type === 'AGENCY' || f.type === 'COMPANY');
    const sumBal = (folios: typeof r.folios) =>
      folios.reduce((s, f) => s + folioBalance(f.charges, f.payments), 0);
    const daily =
      r.manualDailyRate != null ? decimalToNumber(r.manualDailyRate) : total / nights;
    return {
      id: r.id,
      resNo: r.resNo,
      roomId: r.roomId,
      checkInDate: r.checkInDate.toISOString(),
      checkOutDate: r.checkOutDate.toISOString(),
      status: r.status,
      paymentMethod: r.paymentMethod,
      paidBy: r.paidBy,
      totalAmount: total,
      dailyRate: Number.isFinite(daily) ? Math.round(daily * 100) / 100 : null,
      guestBalance: guestFolios.length ? Math.round(sumBal(guestFolios) * 100) / 100 : null,
      agencyBalance: agencyFolios.length ? Math.round(sumBal(agencyFolios) * 100) / 100 : null,
      adults: r.adults,
      children11_6: r.children11_6,
      children5_2: r.children5_2,
      children1_0: r.children1_0,
      mealPlanCode: r.mealPlan?.code ?? null,
      voucherNo: r.voucherNo,
      note: pickNote(r.notes, r.voucherNo),
      shareEligible: r.shareEligible,
      shareGender: r.shareGender,
      shareBedIndex: r.shareBedIndex,
      guest: r.guest,
      partyNames: r.paxGuests
        .filter((p) => !p.isPrimary)
        .map((p) => [p.firstName, p.lastName].filter(Boolean).join(' ').trim())
        .filter(Boolean),
      roomType: r.roomType,
      room: r.room,
      agency: r.agency,
      source: r.source,
    };
  }

  const roomChanges = await prisma.roomChangePlan.findMany({
    where: {
      reservationId: { in: reservations.map((row) => row.id) },
      status: { not: 'CANCELLED' },
    },
    select: { reservationId: true, fromRoomId: true, effectiveAt: true },
  });
  const changesByStay = new Map<string, { fromRoomId: string | null; effectiveAt: Date }[]>();
  for (const change of roomChanges) {
    const list = changesByStay.get(change.reservationId) ?? [];
    list.push({ fromRoomId: change.fromRoomId, effectiveAt: change.effectiveAt });
    changesByStay.set(change.reservationId, list);
  }
  const stayLayout = new Map(
    reservations.map((row) => [
      row.id,
      roomPlanSpans({
        reservationId: row.id,
        roomId: row.roomId,
        checkIn: row.checkInDate,
        checkOut: row.checkOutDate,
        slices: row.staySlices ?? [],
        changes: changesByStay.get(row.id) ?? [],
        dayKey: hotelDateKey,
      }),
    ]),
  );

  for (const r of reservations) {
    const spans = (stayLayout.get(r.id)?.placed ?? []).map((span) => ({
      roomId: span.roomId,
      from: hotelDateKey(span.from),
      to: hotelDateKey(span.to),
    }));
    for (const span of spans) {
      for (const dk of dateKeys) {
        if (dk >= span.from && dk < span.to) {
          occupiedByDay.get(dk)?.add(span.roomId);
        }
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
      for (const span of stayLayout.get(r.id)?.placed ?? []) {
        if (!roomList.some((x) => x.id === span.roomId)) continue;
        const ciKey = hotelDateKey(span.from);
        const coKey = hotelDateKey(span.to);
        for (const dk of dateKeys) {
          if (dk >= ciKey && dk < coKey) {
            out[dk] = Math.max(0, (out[dk] ?? roomList.length) - 1);
          }
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
    rooms: rooms.map((room) => {
      const shareStays = reservations.flatMap((stay) => {
        if (!stay.shareEligible || !stay.shareGender || stay.adults !== 1) return [];
        const spans = (stayLayout.get(stay.id)?.placed ?? []).map((span) => ({
          roomId: span.roomId,
          from: span.from,
          to: span.to,
        }));
        return spans
          .filter((span) => span.roomId === room.id)
          .map((span) => ({
            shareGender: stay.shareGender,
            checkInDate: span.from,
            checkOutDate: span.to,
          }));
      });
      const maxBed = room.maxBed ?? room.roomType.adultCapacity ?? 2;
      let sharePool: { gender: string; occupied: number; capacity: number } | null = null;
      const mixedClosedPair = dateKeys.some((day) => {
        const genders = new Set<string>();
        for (const stay of shareStays) {
          const ci = hotelDateKey(stay.checkInDate);
          const co = hotelDateKey(stay.checkOutDate);
          if (ci <= day && day < co) {
            const g = normalizeShareGender(stay.shareGender);
            if (g) genders.add(g);
          }
        }
        return genders.size > 1;
      });
      if (shareStays.length > 0 && !mixedClosedPair) {
        let peakOccupied = 0;
        let peakGender = shareStays[0]!.shareGender!;
        for (const day of dateKeys) {
          const dayStart = parseHotelNoon(day);
          const dayEnd = new Date(dayStart);
          dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
          const byGender = new Map<string, number>();
          for (const stay of shareStays) {
            const ci = stay.checkInDate.getTime();
            const co = stay.checkOutDate.getTime();
            if (ci >= dayEnd.getTime() || co <= dayStart.getTime()) continue;
            const g = stay.shareGender!;
            byGender.set(g, (byGender.get(g) ?? 0) + 1);
          }
          for (const [g, count] of byGender) {
            if (count > peakOccupied) {
              peakOccupied = count;
              peakGender = g;
            }
          }
        }
        sharePool = {
          gender: peakGender,
          occupied: Math.max(peakOccupied, 1),
          capacity: maxBed,
        };
      }
      return {
        ...room,
        hkCondition: room.hkCondition ?? null,
        sharePool,
      };
    }),
    reservations: reservations.flatMap((row) => {
      const base = mapBar(row);
      const placed = stayLayout.get(row.id)?.placed ?? [];
      if (placed.length === 0) return [];
      if (placed.length === 1 && placed[0]!.key === row.id) {
        return [{ ...base, roomId: placed[0]!.roomId }];
      }
      return placed.map((span) => ({
        ...base,
        barKey: span.key,
        roomId: span.roomId,
        checkInDate: span.from.toISOString(),
        checkOutDate: span.to.toISOString(),
      }));
    }),
    unassigned: [
      ...unassigned,
      ...reservations.flatMap((row) => {
        const layout = stayLayout.get(row.id);
        if (!layout || layout.placed.length === 0) return [];
        return layout.unplaced.map((slice) => ({
          id: row.id,
          chipKey: `${row.id}:${slice.id}`,
          segmentNote: `${hotelDateKey(slice.fromDate)}–${hotelDateKey(slice.toDate)} ${
            row.staySlices?.find((item) => item.id === slice.id)?.roomType?.code ?? ''
          }`.trim(),
          guest: row.guest,
          checkInDate: slice.fromDate,
          checkOutDate: slice.toDate,
          status: row.status,
          roomType: row.staySlices?.find((item) => item.id === slice.id)?.roomType ?? row.roomType,
        }));
      }),
    ],
    availabilityByDay,
    groups,
  };
}
