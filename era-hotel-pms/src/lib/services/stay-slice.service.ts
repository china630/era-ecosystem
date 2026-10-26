import { todayBakuYmd, bakuCivilUtcDate } from '@era/satellite-kit/time';
import { prisma } from '@/lib/prisma';
import { hotelDateKey } from '@/lib/hotel-calendar';
import { dateOnlyUtc, isoDate } from '@/lib/services/door-type.policy';
import { alignStaySlices } from '@/lib/services/stay-slice-align';
import { forwardDoorGaps, planDoorMove } from '@/lib/services/stay-door-move';

export async function resolveStaySliceForDate(reservationId: string, stayDate: Date) {
  const day = dateOnlyUtc(stayDate);
  const slices = await prisma.reservationStaySlice.findMany({
    where: { reservationId },
    orderBy: { fromDate: 'asc' },
  });
  const hit = slices.find((s) => dateOnlyUtc(s.fromDate) <= day && day < dateOnlyUtc(s.toDate));
  if (hit) return hit;
  const res = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: { roomTypeId: true, ratePlanId: true, checkInDate: true, checkOutDate: true },
  });
  if (!res) return null;
  return {
    id: '',
    reservationId,
    fromDate: res.checkInDate,
    toDate: res.checkOutDate,
    roomTypeId: res.roomTypeId,
    ratePlanId: res.ratePlanId,
    roomId: null,
    createdAt: new Date(),
  };
}

export async function replaceSlicesFromDate(input: {
  reservationId: string;
  fromDate: Date;
  roomTypeId: string;
  ratePlanId: string;
  checkOutDate: Date;
  roomId?: string | null;
  /** Door that stays on the segment before the split, when that slice has no room yet. */
  keepRoomId?: string | null;
}) {
  const from = dateOnlyUtc(input.fromDate);
  const checkout = dateOnlyUtc(input.checkOutDate);
  const existing = await prisma.reservationStaySlice.findMany({
    where: { reservationId: input.reservationId },
    orderBy: { fromDate: 'asc' },
  });

  await prisma.$transaction(async (tx) => {
    for (const slice of existing) {
      const sFrom = dateOnlyUtc(slice.fromDate);
      const sTo = dateOnlyUtc(slice.toDate);
      if (sTo <= from) continue;
      if (sFrom >= from) {
        await tx.reservationStaySlice.delete({ where: { id: slice.id } });
        continue;
      }
      await tx.reservationStaySlice.update({
        where: { id: slice.id },
        data: {
          toDate: from,
          ...(slice.roomId || !input.keepRoomId ? {} : { roomId: input.keepRoomId }),
        },
      });
    }
    await tx.reservationStaySlice.create({
      data: {
        reservationId: input.reservationId,
        fromDate: from,
        toDate: checkout,
        roomTypeId: input.roomTypeId,
        ratePlanId: input.ratePlanId,
        roomId: input.roomId ?? null,
      },
    });
  });
}

/** Second segment from `fromDate` until checkout. Holds a door when roomId is set, otherwise the type quota. */
export async function splitStayFromDate(input: {
  reservationId: string;
  fromDate: Date;
  roomTypeId: string;
  roomId?: string | null;
  actorUserId?: string | null;
}) {
  const res = await prisma.reservation.findUnique({ where: { id: input.reservationId } });
  if (!res) throw new Error('Reservation not found');
  if (input.roomId) {
    const { assertNamedGuestsFreeOnStay } = await import('@/lib/services/reservation.service');
    await assertNamedGuestsFreeOnStay(input.reservationId);
  }
  if (res.status !== 'CONFIRMED' && res.status !== 'OPTION' && res.status !== 'IN_HOUSE') {
    throw new Error('Stay cannot be split');
  }
  const from = dateOnlyUtc(input.fromDate);
  const checkIn = dateOnlyUtc(res.checkInDate);
  const checkOut = dateOnlyUtc(res.checkOutDate);
  if (from.getTime() <= checkIn.getTime() || from.getTime() >= checkOut.getTime()) {
    throw new Error('Split date must be inside the stay');
  }

  if (input.roomId) {
    const room = await prisma.room.findUnique({ where: { id: input.roomId } });
    if (!room) throw new Error('Room not found');
    if (room.roomTypeId !== input.roomTypeId) throw new Error('Room does not match room type');
    const { resolveDoorAssignment } = await import('@/lib/services/share-assignment.service');
    await resolveDoorAssignment({
      roomId: input.roomId,
      checkIn: from,
      checkOut,
      excludeReservationId: res.id,
      candidate: {
        shareEligible: false,
        shareGender: null,
        adults: res.adults,
      },
    });
  } else {
    const { getAvailability } = await import('@/lib/services/reservation.service');
    const avail = await getAvailability(input.roomTypeId, from, checkOut, res.id);
    if (avail.available < 1 || avail.stopSell) {
      throw new Error('No availability for that room type');
    }
  }

  await replaceSlicesFromDate({
    reservationId: res.id,
    fromDate: from,
    roomTypeId: input.roomTypeId,
    ratePlanId: res.ratePlanId,
    checkOutDate: checkOut,
    roomId: input.roomId ?? null,
    keepRoomId: res.roomId,
  });

  await prisma.roomChangePlan.create({
    data: {
      organizationId: res.organizationId,
      reservationId: res.id,
      fromRoomId: res.roomId,
      toRoomId: input.roomId ?? null,
      effectiveAt: from,
      kind: 'SCHEDULED',
      status: 'PENDING',
      createdByUserId: input.actorUserId ?? undefined,
    },
  });
}

const LIVE_STAY = ['OPTION', 'CONFIRMED', 'IN_HOUSE'] as const;

function doorEffective(status: string, checkIn: Date): Date {
  const key = status === 'IN_HOUSE' ? todayBakuYmd() : hotelDateKey(checkIn);
  return bakuCivilUtcDate(key);
}

/** Point future nights of `fromRoomId` at `toRoomId`. Past nights stay put. */
export async function moveStayDoor(input: {
  reservationId: string;
  fromRoomId: string | null | undefined;
  toRoomId: string | null;
  status: string;
  checkIn: Date;
}) {
  if (!input.fromRoomId || input.fromRoomId === input.toRoomId) return;
  const [slices, pending, stay] = await Promise.all([
    prisma.reservationStaySlice.findMany({
      where: { reservationId: input.reservationId },
    }),
    prisma.roomChangePlan.findMany({
      where: { reservationId: input.reservationId, status: 'PENDING' },
      select: { toRoomId: true },
    }),
    prisma.reservation.findUnique({
      where: { id: input.reservationId },
      select: { checkOutDate: true, roomTypeId: true, ratePlanId: true, organizationId: true },
    }),
  ]);
  if (!stay) return;
  const effective = doorEffective(input.status, input.checkIn);
  const plan = planDoorMove({
    slices,
    fromRoomId: input.fromRoomId,
    toRoomId: input.toRoomId,
    effective,
    keepRoomIds: pending.map((row) => row.toRoomId).filter((id): id is string => Boolean(id)),
    dayKey: hotelDateKey,
  });
  const gaps = forwardDoorGaps({
    slices,
    updates: plan.updates,
    creates: plan.creates,
    effective,
    checkOut: stay.checkOutDate,
    toRoomId: input.toRoomId,
    dayKey: hotelDateKey,
    template: { roomTypeId: stay.roomTypeId, ratePlanId: stay.ratePlanId },
  });
  await applyDoorPlan(input.reservationId, slices[0]?.organizationId ?? stay.organizationId, {
    updates: plan.updates,
    creates: [...plan.creates, ...gaps],
  });
}

async function applyDoorPlan(
  reservationId: string,
  organizationId: string | undefined,
  plan: ReturnType<typeof planDoorMove>,
) {
  if (plan.updates.length === 0 && plan.creates.length === 0) return;
  await prisma.$transaction(async (tx) => {
    for (const update of plan.updates) {
      await tx.reservationStaySlice.update({
        where: { id: update.id },
        data: {
          ...(update.toDate ? { toDate: update.toDate } : {}),
          ...(update.roomId !== undefined ? { roomId: update.roomId } : {}),
        },
      });
    }
    if (plan.creates.length > 0) {
      const org =
        organizationId ??
        (
          await tx.reservation.findUnique({
            where: { id: reservationId },
            select: { organizationId: true },
          })
        )?.organizationId;
      if (!org) throw new Error('Reservation not found');
      await tx.reservationStaySlice.createMany({
        data: plan.creates.map((slice) => ({
          organizationId: org,
          reservationId,
          fromDate: slice.fromDate,
          toDate: slice.toDate,
          roomId: slice.roomId,
          roomTypeId: slice.roomTypeId,
          ratePlanId: slice.ratePlanId,
        })),
      });
    }
  });
}

const ALIGN_STATUSES = ['OPTION', 'CONFIRMED', 'IN_HOUSE', 'CHECKED_OUT'] as const;

type AlignStayRow = {
  id: string;
  status: string;
  roomId: string | null;
  roomTypeId: string;
  ratePlanId: string;
  checkInDate: Date;
  checkOutDate: Date;
  organizationId: string;
  staySlices: AlignSliceRow[];
};

type AlignSliceRow = {
  id: string;
  fromDate: Date;
  toDate: Date;
  roomId: string | null;
  roomTypeId: string;
  ratePlanId: string;
};

async function applyStaySliceAlign(stay: AlignStayRow) {
  if (!ALIGN_STATUSES.includes(stay.status as (typeof ALIGN_STATUSES)[number])) return;
  const plan = alignStaySlices({
    checkIn: stay.checkInDate,
    checkOut: stay.checkOutDate,
    roomId: stay.roomId,
    roomTypeId: stay.roomTypeId,
    ratePlanId: stay.ratePlanId,
    slices: stay.staySlices,
    datesOnly: stay.status === 'CHECKED_OUT',
  });
  if (plan.updates.length === 0 && plan.deletes.length === 0 && plan.creates.length === 0) return;
  await prisma.$transaction(async (tx) => {
    if (plan.deletes.length > 0) {
      await tx.reservationStaySlice.deleteMany({ where: { id: { in: plan.deletes } } });
    }
    for (const update of plan.updates) {
      await tx.reservationStaySlice.update({
        where: { id: update.id },
        data: {
          ...(update.fromDate ? { fromDate: update.fromDate } : {}),
          ...(update.toDate ? { toDate: update.toDate } : {}),
          ...(update.roomId !== undefined ? { roomId: update.roomId } : {}),
        },
      });
    }
    if (plan.creates.length > 0) {
      await tx.reservationStaySlice.createMany({
        data: plan.creates.map((slice) => ({
          organizationId: stay.organizationId,
          reservationId: stay.id,
          fromDate: slice.fromDate,
          toDate: slice.toDate,
          roomId: slice.roomId,
          roomTypeId: slice.roomTypeId,
          ratePlanId: slice.ratePlanId,
        })),
      });
    }
  });
}

/** Clamp slices to the header stay and pin a missing door. Checked-out stays only lose extra dates. */
export async function alignReservationStaySlices(reservationId: string) {
  const stay = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      status: true,
      roomId: true,
      roomTypeId: true,
      ratePlanId: true,
      checkInDate: true,
      checkOutDate: true,
      organizationId: true,
      staySlices: true,
    },
  });
  if (!stay) return;
  await applyStaySliceAlign(stay);
}

/**
 * Live stays whose header door moved but a future slice still pins the old door.
 * A pending scheduled door is left on its slice. Slice dates are clamped to the header first.
 */
export async function repairLiveStayDoors() {
  const live = await prisma.reservation.findMany({
    where: { status: { in: [...LIVE_STAY] } },
    select: {
      id: true,
      status: true,
      roomId: true,
      roomTypeId: true,
      ratePlanId: true,
      checkInDate: true,
      checkOutDate: true,
      organizationId: true,
      staySlices: true,
    },
  });
  for (const stay of live) {
    await applyStaySliceAlign(stay);
  }
  const stays = await prisma.reservation.findMany({
    where: { status: { in: [...LIVE_STAY] }, roomId: { not: null } },
    select: {
      id: true,
      status: true,
      roomId: true,
      checkInDate: true,
      organizationId: true,
      staySlices: true,
      roomChanges: {
        where: { status: 'PENDING' },
        select: { toRoomId: true },
      },
    },
  });
  for (const stay of stays) {
    if (!stay.roomId) continue;
    const keep = stay.roomChanges
      .map((row) => row.toRoomId)
      .filter((id): id is string => Boolean(id));
    const effective = doorEffective(stay.status, stay.checkInDate);
    const fromRooms = [
      ...new Set(
        stay.staySlices
          .map((slice) => slice.roomId)
          .filter((id): id is string => id != null && id !== stay.roomId && !keep.includes(id)),
      ),
    ];
    for (const fromRoomId of fromRooms) {
      const plan = planDoorMove({
        slices: stay.staySlices,
        fromRoomId,
        toRoomId: stay.roomId,
        effective,
        keepRoomIds: keep,
        dayKey: hotelDateKey,
      });
      await applyDoorPlan(stay.id, stay.organizationId, plan);
    }
  }
}

export { isoDate };
