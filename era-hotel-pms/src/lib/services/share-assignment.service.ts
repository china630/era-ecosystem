import { prisma } from '@/lib/prisma';
import { isOtaAgency } from '@/lib/booking-source-kind';
import { hotelDateKey, parseHotelNoon, reservationStayOverlaps } from '@/lib/hotel-calendar';
import { canAssignDoor, resolveAxes, roomWriteFromAxes } from '@/lib/room-state';

export const SCHEDULABLE_STATUSES = ['CONFIRMED', 'IN_HOUSE', 'OPTION'] as const;

export type ShareGender = 'M' | 'F';

export type ShareReservationSlice = {
  id: string;
  roomId: string | null;
  shareEligible: boolean;
  shareGender: string | null;
  adults: number;
  checkInDate: Date;
  checkOutDate: Date;
  shareBedIndex?: number | null;
};

export function normalizeShareGender(g: string | null | undefined): ShareGender | null {
  if (!g) return null;
  const u = g.trim().toUpperCase();
  if (u === 'M' || u === 'MALE' || u === '♂') return 'M';
  if (u === 'F' || u === 'FEMALE' || u === '♀') return 'F';
  return null;
}

export function resolveMaxBed(
  roomMaxBed: number | null | undefined,
  roomTypeCapacity: number | null | undefined,
): number {
  const cap = roomTypeCapacity ?? 2;
  const bed = roomMaxBed ?? cap;
  return Math.max(1, Math.min(bed, cap));
}

/** Effective share consumes inventory and may share a door. */
export function isEffectiveShare(r: {
  shareEligible: boolean;
  shareGender: string | null;
  adults: number;
}): boolean {
  if (!r.shareEligible) return false;
  if (r.adults !== 1) return false;
  return normalizeShareGender(r.shareGender) !== null;
}

function eachNight(from: Date, to: Date): Date[] {
  const nights: Date[] = [];
  const cur = new Date(from);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (cur < end) {
    nights.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return nights;
}

function overlapsStay(r: ShareReservationSlice, checkIn: Date, checkOut: Date): boolean {
  return reservationStayOverlaps(r, { checkInDate: checkIn, checkOutDate: checkOut });
}

export function canGuestJoinSharePool(input: {
  adults: number;
  shareGender?: string | null;
  guestGender?: string | null;
  isOta?: boolean;
}): { ok: true; gender: ShareGender } | { ok: false; reason: string } {
  if (input.adults !== 1) {
    return { ok: false, reason: 'adults_not_1' };
  }
  if (input.isOta) {
    return { ok: false, reason: 'ota' };
  }
  const gender =
    normalizeShareGender(input.shareGender) ?? normalizeShareGender(input.guestGender);
  if (!gender) {
    return { ok: false, reason: 'no_gender' };
  }
  return { ok: true, gender };
}

export type DoorAssignmentCandidate = {
  shareEligible: boolean;
  shareGender: string | null;
  adults: number;
  isOta?: boolean;
  guestGender?: string | null;
};

export type DoorAssignmentResult = {
  shareBedIndex: number | null;
  joiningPool: boolean;
  shareEligible: boolean;
  shareGender: string | null;
  autoShare: boolean;
  pulledNeighborIds: string[];
};

type DoorOverlapRow = {
  id: string;
  shareEligible: boolean;
  shareGender: string | null;
  adults: number;
  checkInDate: Date;
  checkOutDate: Date;
  shareBedIndex: number | null;
  guest: { gender: string | null };
  agency: { code: string; name: string } | null;
};

async function loadDoorOverlaps(input: {
  roomId: string;
  checkIn: Date;
  checkOut: Date;
  excludeReservationId?: string;
  statuses?: readonly string[];
}): Promise<DoorOverlapRow[]> {
  const statuses = input.statuses ?? SCHEDULABLE_STATUSES;
  const rows = await prisma.reservation.findMany({
    where: {
      roomId: input.roomId,
      ...(input.excludeReservationId ? { id: { not: input.excludeReservationId } } : {}),
      status: { in: [...statuses] },
      checkInDate: { lt: input.checkOut },
      checkOutDate: { gt: input.checkIn },
    },
    select: {
      id: true,
      shareEligible: true,
      shareGender: true,
      adults: true,
      checkInDate: true,
      checkOutDate: true,
      shareBedIndex: true,
      guest: { select: { gender: true } },
      agency: { select: { code: true, name: true } },
    },
  });
  return rows.filter((r) =>
    reservationStayOverlaps(r, { checkInDate: input.checkIn, checkOutDate: input.checkOut }),
  );
}

function gateRowForShare(row: DoorOverlapRow): ReturnType<typeof canGuestJoinSharePool> {
  return canGuestJoinSharePool({
    adults: row.adults,
    shareGender: row.shareGender,
    guestGender: row.guest.gender,
    isOta: row.agency ? isOtaAgency(row.agency.code, row.agency.name) : false,
  });
}

/**
 * Mark all share-eligible overlapping stays on a door with beds (pulls former exclusives).
 */
export async function openSharePoolForDoor(input: {
  roomId: string;
  checkIn: Date;
  checkOut: Date;
  excludeReservationId?: string;
  poolGender: ShareGender;
  /** When set, only these reservation ids (plus exclude filter) participate. */
  reservationIds?: string[];
  dryRun?: boolean;
}): Promise<Array<{ id: string; shareBedIndex: number; shareGender: ShareGender }>> {
  const room = await prisma.room.findUnique({
    where: { id: input.roomId },
    include: { roomType: true },
  });
  if (!room) throw new Error('Room not found');
  const maxBed = resolveMaxBed(room.maxBed, room.roomType.adultCapacity);

  let rows = await loadDoorOverlaps({
    roomId: input.roomId,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    excludeReservationId: input.excludeReservationId,
  });
  if (input.reservationIds?.length) {
    const allowed = new Set(input.reservationIds);
    rows = rows.filter((r) => allowed.has(r.id));
  }

  const members = rows
    .map((row) => {
      const gate = gateRowForShare(row);
      if (!gate.ok || gate.gender !== input.poolGender) return null;
      return {
        id: row.id,
        existingBed: row.shareBedIndex,
        checkInDate: row.checkInDate,
        checkOutDate: row.checkOutDate,
      };
    })
    .filter((m): m is NonNullable<typeof m> => m != null)
    .sort((a, b) => {
      const ci = a.checkInDate.getTime() - b.checkInDate.getTime();
      if (ci !== 0) return ci;
      return a.id.localeCompare(b.id);
    });

  const assigned: Array<{ id: string; shareBedIndex: number; shareGender: ShareGender }> = [];
  for (const m of members) {
    const bedInput = {
      overlapping: assigned.map((a) => {
        const src = members.find((x) => x.id === a.id)!;
        return {
          id: a.id,
          checkInDate: src.checkInDate,
          checkOutDate: src.checkOutDate,
          shareBedIndex: a.shareBedIndex,
        };
      }),
      checkIn: m.checkInDate,
      checkOut: m.checkOutDate,
      maxBed,
    };
    const prefer =
      m.existingBed != null && m.existingBed >= 1 && m.existingBed <= maxBed
        ? m.existingBed
        : nextFreeShareBedIndex(bedInput);
    assigned.push({
      id: m.id,
      shareBedIndex: prefer,
      shareGender: input.poolGender,
    });
  }

  if (!input.dryRun) {
    for (const a of assigned) {
      await prisma.reservation.update({
        where: { id: a.id },
        data: {
          shareEligible: true,
          shareGender: a.shareGender,
          shareBedIndex: a.shareBedIndex,
        },
      });
    }
  }
  return assigned;
}

/**
 * Assign / relocate door: overlap → share pool (auto) or 409. Pulls neighbors into pool.
 */
export async function resolveDoorAssignment(input: {
  roomId: string;
  checkIn: Date;
  checkOut: Date;
  excludeReservationId?: string;
  candidate: DoorAssignmentCandidate;
}): Promise<DoorAssignmentResult> {
  const room = await prisma.room.findUnique({
    where: { id: input.roomId },
    include: { roomType: true },
  });
  if (!room) throw new Error('Room not found');
  const maxBed = resolveMaxBed(room.maxBed, room.roomType.adultCapacity);

  const neighbors = await loadDoorOverlaps({
    roomId: input.roomId,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    excludeReservationId: input.excludeReservationId,
  });

  let shareEligible = input.candidate.shareEligible;
  let shareGender =
    normalizeShareGender(input.candidate.shareGender) ??
    normalizeShareGender(input.candidate.guestGender);
  let autoShare = false;

  if (neighbors.length === 0) {
    if (shareEligible && isEffectiveShare({ shareEligible, shareGender, adults: input.candidate.adults })) {
      validateShareCandidate({ ...input.candidate, shareEligible: true, shareGender });
      return {
        shareBedIndex: 1,
        joiningPool: false,
        shareEligible: true,
        shareGender,
        autoShare: false,
        pulledNeighborIds: [],
      };
    }
    return {
      shareBedIndex: null,
      joiningPool: false,
      shareEligible: false,
      shareGender: null,
      autoShare: false,
      pulledNeighborIds: [],
    };
  }

  const gate = canGuestJoinSharePool({
    adults: input.candidate.adults,
    shareGender: input.candidate.shareGender,
    guestGender: input.candidate.guestGender,
    isOta: input.candidate.isOta,
  });

  if (shareEligible && isEffectiveShare({ shareEligible, shareGender, adults: input.candidate.adults })) {
    validateShareCandidate({ ...input.candidate, shareEligible: true, shareGender });
  } else if (gate.ok) {
    shareEligible = true;
    shareGender = gate.gender;
    autoShare = true;
    validateShareCandidate({
      shareEligible: true,
      shareGender,
      adults: input.candidate.adults,
      isOta: input.candidate.isOta,
    });
  } else {
    const first = neighbors[0]!;
    if (gate.reason === 'ota') {
      throw new Error('OTA reservations cannot use shared twin assignment');
    }
    if (gate.reason === 'adults_not_1') {
      throw new Error('Shared twin is only allowed for single-adult stays');
    }
    if (gate.reason === 'no_gender') {
      throw new Error('Gender is required for shared twin stays');
    }
    throw new Error(
      `Room conflict: overlapping stay (${first.checkInDate.toISOString().slice(0, 10)} – ${first.checkOutDate.toISOString().slice(0, 10)})`,
    );
  }

  const candGender = shareGender!;
  const pullableNeighborIds: string[] = [];
  for (const n of neighbors) {
    if (isEffectiveShare(n)) {
      const poolGender = normalizeShareGender(n.shareGender);
      if (poolGender !== candGender) {
        throw new Error('Opposite gender cannot share this room');
      }
      continue;
    }
    const nGate = gateRowForShare(n);
    if (!nGate.ok || nGate.gender !== candGender) {
      throw new Error(
        `Room conflict: overlapping stay cannot join share pool (${n.checkInDate.toISOString().slice(0, 10)} – ${n.checkOutDate.toISOString().slice(0, 10)})`,
      );
    }
    pullableNeighborIds.push(n.id);
  }

  const shareNeighbors = neighbors.filter(isEffectiveShare);

  const bedInput = {
    overlapping: [
      ...shareNeighbors.map((r) => ({
        id: r.id,
        checkInDate: r.checkInDate,
        checkOutDate: r.checkOutDate,
        shareBedIndex: r.shareBedIndex,
      })),
    ],
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    maxBed,
  };

  const pulledNeighborIds = [...shareNeighbors.map((n) => n.id), ...pullableNeighborIds];
  if (pullableNeighborIds.length > 0) {
    const pulled = await openSharePoolForDoor({
      roomId: input.roomId,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      excludeReservationId: input.excludeReservationId,
      poolGender: candGender,
      reservationIds: pullableNeighborIds,
    });
    for (const p of pulled) {
      const row = neighbors.find((n) => n.id === p.id);
      if (!row) continue;
      bedInput.overlapping.push({
        id: p.id,
        checkInDate: row.checkInDate,
        checkOutDate: row.checkOutDate,
        shareBedIndex: p.shareBedIndex,
      });
    }
  }

  if (isSharePoolFullPerNight(bedInput)) {
    throw new Error('Share pool on this room is full');
  }
  const shareBedIndex = nextFreeShareBedIndex(bedInput);

  return {
    shareBedIndex,
    joiningPool: shareNeighbors.length > 0 || autoShare,
    shareEligible: true,
    shareGender: candGender,
    autoShare,
    pulledNeighborIds,
  };
}

function overlapsNight(r: ShareReservationSlice, night: Date): boolean {
  const nightEnd = new Date(night);
  nightEnd.setDate(nightEnd.getDate() + 1);
  return r.checkInDate < nightEnd && r.checkOutDate > night;
}

/** Count physical doors consumed on one hotel night. */
export function countDoorsUsedOnNight(
  reservations: ShareReservationSlice[],
  night: Date,
  maxBedDefault: number,
): number {
  const active = reservations.filter((r) => overlapsNight(r, night));
  let doors = 0;
  const assignedShareByRoom = new Map<string, ShareReservationSlice[]>();
  let unassignedM = 0;
  let unassignedF = 0;

  for (const r of active) {
    if (r.shareEligible && !isEffectiveShare(r)) {
      continue;
    }
    if (!isEffectiveShare(r)) {
      doors += 1;
      continue;
    }
    const gender = normalizeShareGender(r.shareGender)!;
    if (r.roomId) {
      const list = assignedShareByRoom.get(r.roomId) ?? [];
      list.push(r);
      assignedShareByRoom.set(r.roomId, list);
    } else if (gender === 'M') {
      unassignedM += 1;
    } else {
      unassignedF += 1;
    }
  }

  doors += assignedShareByRoom.size;
  doors += Math.ceil(unassignedM / maxBedDefault);
  doors += Math.ceil(unassignedF / maxBedDefault);
  return doors;
}

export function maxDoorsUsedInRange(
  reservations: ShareReservationSlice[],
  from: Date,
  to: Date,
  maxBedDefault: number,
): number {
  const nights = eachNight(from, to);
  if (nights.length === 0) return 0;
  let maxDoors = 0;
  for (const night of nights) {
    const used = countDoorsUsedOnNight(reservations, night, maxBedDefault);
    if (used > maxDoors) maxDoors = used;
  }
  return maxDoors;
}

export async function loadShareSlicesForType(
  roomTypeId: string,
  from: Date,
  to: Date,
  excludeReservationId?: string,
): Promise<ShareReservationSlice[]> {
  return prisma.reservation.findMany({
    where: {
      roomTypeId,
      ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
      status: { in: [...SCHEDULABLE_STATUSES] },
      checkInDate: { lt: to },
      checkOutDate: { gt: from },
    },
    select: {
      id: true,
      roomId: true,
      shareEligible: true,
      shareGender: true,
      adults: true,
      checkInDate: true,
      checkOutDate: true,
    },
  });
}

export async function countDoorsUsedForRoomType(
  roomTypeId: string,
  from: Date,
  to: Date,
  excludeReservationId?: string,
): Promise<number> {
  const roomType = await prisma.roomType.findUnique({ where: { id: roomTypeId } });
  if (!roomType) throw new Error('Room type not found');
  const maxBed = resolveMaxBed(null, roomType.adultCapacity);
  const reservations = await loadShareSlicesForType(roomTypeId, from, to, excludeReservationId);
  return maxDoorsUsedInRange(reservations, from, to, maxBed);
}

export async function getDoorAvailability(
  roomTypeId: string,
  from: Date,
  to: Date,
  excludeReservationId?: string,
): Promise<{ quota: number; booked: number; available: number }> {
  const roomType = await prisma.roomType.findUnique({ where: { id: roomTypeId } });
  if (!roomType) throw new Error('Room type not found');
  const booked = await countDoorsUsedForRoomType(roomTypeId, from, to, excludeReservationId);
  return { quota: roomType.baseQuota, booked, available: Math.max(0, roomType.baseQuota - booked) };
}

export function validateShareCandidate(candidate: {
  shareEligible: boolean;
  shareGender: string | null;
  adults: number;
  isOta?: boolean;
}): void {
  if (!candidate.shareEligible) return;
  if (candidate.isOta) {
    throw new Error('OTA reservations cannot use shared twin assignment');
  }
  if (candidate.adults !== 1) {
    throw new Error('Shared twin is only allowed for single-adult stays');
  }
  if (!normalizeShareGender(candidate.shareGender)) {
    throw new Error('Gender is required for shared twin stays');
  }
}

export async function reservationIsOta(reservationId: string): Promise<boolean> {
  const res = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { agency: true, source: true },
  });
  if (!res) return false;
  if (res.agency && isOtaAgency(res.agency.code, res.agency.name)) return true;
  const src = (res.source?.code ?? '').toUpperCase();
  return src === 'BOOKING' || src === 'OTA' || src === 'CHANNEL';
}

export async function assertShareInventory(
  roomTypeId: string,
  from: Date,
  to: Date,
  candidate: {
    id?: string;
    shareEligible: boolean;
    shareGender: string | null;
    adults: number;
    roomId?: string | null;
    isOta?: boolean;
  },
): Promise<void> {
  const roomType = await prisma.roomType.findUnique({ where: { id: roomTypeId } });
  if (!roomType) throw new Error('Room type not found');
  const maxBed = resolveMaxBed(null, roomType.adultCapacity);

  if (candidate.shareEligible) {
    validateShareCandidate(candidate);
  }

  const existing = await loadShareSlicesForType(roomTypeId, from, to, candidate.id);
  const withCandidate: ShareReservationSlice = {
    id: candidate.id ?? '__candidate__',
    roomId: candidate.roomId ?? null,
    shareEligible: candidate.shareEligible,
    shareGender: candidate.shareGender,
    adults: candidate.adults,
    checkInDate: from,
    checkOutDate: to,
  };
  const all = [...existing, withCandidate];
  const nights = eachNight(from, to);
  for (const night of nights) {
    const used = countDoorsUsedOnNight(all, night, maxBed);
    if (used > roomType.baseQuota) {
      throw new Error('No availability for room type');
    }
  }
}

export type SharePoolOnDoor = {
  gender: ShareGender;
  count: number;
  maxBed: number;
  bedIndices: number[];
};

export function deriveSharePoolOnDoor(
  overlapping: ShareReservationSlice[],
  maxBed: number,
): SharePoolOnDoor | null {
  const shareStays = overlapping.filter(isEffectiveShare);
  if (shareStays.length === 0) return null;
  const gender = normalizeShareGender(shareStays[0]!.shareGender);
  if (!gender) return null;
  if (shareStays.some((s) => normalizeShareGender(s.shareGender) !== gender)) {
    return null;
  }
  const bedIndices: number[] = [];
  return {
    gender,
    count: shareStays.length,
    maxBed,
    bedIndices,
  };
}

export function nextShareBedIndex(
  overlapping: Array<{ shareBedIndex?: number | null }>,
  maxBed: number,
): number {
  const used = new Set(
    overlapping.map((r) => r.shareBedIndex).filter((x): x is number => x != null),
  );
  for (let i = 1; i <= maxBed; i++) {
    if (!used.has(i)) return i;
  }
  throw new Error('Share pool on this room is full');
}

type BedOccupant = {
  id: string;
  checkInDate: Date;
  checkOutDate: Date;
  shareBedIndex?: number | null;
};

function eachNightKeys(checkIn: Date, checkOut: Date): string[] {
  const keys: string[] = [];
  const start = hotelDateKey(checkIn);
  const end = hotelDateKey(checkOut);
  let cur = start;
  while (cur < end) {
    keys.push(cur);
    const noon = parseHotelNoon(cur);
    noon.setUTCDate(noon.getUTCDate() + 1);
    cur = hotelDateKey(noon);
  }
  return keys;
}

/**
 * Per-night free bed: minimal index free on every night of the candidate stay.
 * Neighbors with null shareBedIndex still occupy the lowest free slots
 * (stable: CI then id) so a new arrival cannot paint over them.
 */
export function nextFreeShareBedIndex(input: {
  overlapping: BedOccupant[];
  checkIn: Date;
  checkOut: Date;
  maxBed: number;
}): number {
  const nights = eachNightKeys(input.checkIn, input.checkOut);
  if (nights.length === 0) {
    return nextShareBedIndex(input.overlapping, input.maxBed);
  }

  const sorted = [...input.overlapping].sort((a, b) => {
    const ci = a.checkInDate.getTime() - b.checkInDate.getTime();
    if (ci !== 0) return ci;
    return a.id.localeCompare(b.id);
  });

  const occupiedByNight = new Map<string, Set<number>>();
  for (const night of nights) {
    occupiedByNight.set(night, new Set());
  }

  for (const night of nights) {
    const nightStart = parseHotelNoon(night);
    const nightEnd = parseHotelNoon(night);
    nightEnd.setUTCDate(nightEnd.getUTCDate() + 1);
    const active = sorted.filter(
      (r) => r.checkInDate.getTime() < nightEnd.getTime() && r.checkOutDate.getTime() > nightStart.getTime(),
    );
    const used = occupiedByNight.get(night)!;
    const claimed = new Set<number>();
    for (const r of active) {
      if (r.shareBedIndex != null && r.shareBedIndex >= 1 && r.shareBedIndex <= input.maxBed) {
        used.add(r.shareBedIndex);
        claimed.add(r.shareBedIndex);
      }
    }
    for (const r of active) {
      if (r.shareBedIndex != null) continue;
      for (let i = 1; i <= input.maxBed; i++) {
        if (!claimed.has(i)) {
          used.add(i);
          claimed.add(i);
          break;
        }
      }
    }
  }

  for (let bed = 1; bed <= input.maxBed; bed++) {
    const freeAllNights = nights.every((n) => !occupiedByNight.get(n)!.has(bed));
    if (freeAllNights) return bed;
  }
  throw new Error('Share pool on this room is full');
}

/** True when any night of the candidate stay already has maxBed occupied beds. */
export function isSharePoolFullPerNight(input: {
  overlapping: BedOccupant[];
  checkIn: Date;
  checkOut: Date;
  maxBed: number;
}): boolean {
  try {
    nextFreeShareBedIndex(input);
    return false;
  } catch {
    return true;
  }
}

export async function assertRoomShareAssignable(input: {
  roomId: string;
  checkIn: Date;
  checkOut: Date;
  excludeReservationId?: string;
  candidate: {
    shareEligible: boolean;
    shareGender: string | null;
    adults: number;
    isOta?: boolean;
    guestGender?: string | null;
  };
}): Promise<{
  shareBedIndex: number | null;
  joiningPool: boolean;
  shareEligible: boolean;
  shareGender: string | null;
  autoShare: boolean;
}> {
  const result = await resolveDoorAssignment({
    roomId: input.roomId,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    excludeReservationId: input.excludeReservationId,
    candidate: input.candidate,
  });
  return {
    shareBedIndex: result.shareBedIndex,
    joiningPool: result.joiningPool,
    shareEligible: result.shareEligible,
    shareGender: result.shareGender,
    autoShare: result.autoShare,
  };
}

export function roomStatusAllowedForShareAssign(
  room: { status: string; hkCondition?: string | null; inventoryStatus?: string | null },
  joiningPool: boolean,
): boolean {
  const r = {
    status: room.status as import('@prisma/client').RoomStatus,
    hkCondition: room.hkCondition as import('@/lib/room-state').RoomHkCondition | undefined,
    inventoryStatus: room.inventoryStatus as import('@/lib/room-state').RoomInventoryStatus | undefined,
  };
  if (joiningPool) {
    return resolveAxes(r).inventoryStatus === 'IN_SERVICE';
  }
  return canAssignDoor(r, false);
}

export async function countRemainingInHouseOnDoor(roomId: string, excludeReservationId: string) {
  return prisma.reservation.count({
    where: {
      roomId,
      id: { not: excludeReservationId },
      status: 'IN_HOUSE',
    },
  });
}

export async function countAssignedShareOnDoor(roomId: string, excludeReservationId?: string) {
  return prisma.reservation.count({
    where: {
      roomId,
      ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
      shareEligible: true,
      status: { in: [...SCHEDULABLE_STATUSES] },
    },
  });
}

/** Overlapping share roommates on the same door (for neighbor hint / break share). */
export async function listShareNeighborsOnDoor(input: {
  roomId: string;
  checkIn: Date;
  checkOut: Date;
  excludeReservationId: string;
}) {
  const rows = await prisma.reservation.findMany({
    where: {
      roomId: input.roomId,
      id: { not: input.excludeReservationId },
      shareEligible: true,
      status: { in: [...SCHEDULABLE_STATUSES] },
      checkInDate: { lt: input.checkOut },
      checkOutDate: { gt: input.checkIn },
    },
    include: {
      guest: { select: { fullName: true } },
    },
    orderBy: { checkInDate: 'asc' },
  });
  return rows.filter(isEffectiveShare);
}

/**
 * Clear share flags. Refuses with conflict if another share stay still overlaps on the door.
 */
export async function breakShareReservation(reservationId: string) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
  });
  if (!reservation) throw new Error('Reservation not found');
  if (!reservation.shareEligible) {
    return reservation;
  }
  if (reservation.roomId) {
    const neighbors = await listShareNeighborsOnDoor({
      roomId: reservation.roomId,
      checkIn: reservation.checkInDate,
      checkOut: reservation.checkOutDate,
      excludeReservationId: reservationId,
    });
    if (neighbors.length > 0) {
      const n = neighbors[0]!;
      throw new Error(
        `Cannot break share while roommate remains (${n.guest.fullName}) — relocate first`,
      );
    }
  }
  return prisma.reservation.update({
    where: { id: reservationId },
    data: {
      shareEligible: false,
      shareGender: null,
      shareBedIndex: null,
    },
  });
}

/**
 * After checkout/cancel of a stay that held a door: DIRTY if empty, else OCCUPIED + optional bed HK.
 */
export async function releaseDoorAfterShareDeparture(
  // Interactive tx / extended client — kit stamps organizationId on create.
  tx: any,
  input: {
    roomId: string;
    excludeReservationId: string;
    shareBedIndex: number | null | undefined;
    wasInHouse: boolean;
  },
) {
  const othersInHouse = await countRemainingInHouseOnDoor(
    input.roomId,
    input.excludeReservationId,
  );
  const othersAssigned = await countAssignedShareOnDoor(
    input.roomId,
    input.excludeReservationId,
  );
  if (othersInHouse === 0 && othersAssigned === 0) {
    await tx.room.update({
      where: { id: input.roomId },
      data: roomWriteFromAxes('DIRTY', 'IN_SERVICE'),
    });
    await tx.housekeepingTask.create({
      data: {
        roomId: input.roomId,
        status: 'PENDING',
        notes: 'Post check-out',
        jobType: 'DEPARTURE',
      },
    });
    return { doorCleared: true };
  }
  if (input.wasInHouse) {
    const bed = input.shareBedIndex ?? '?';
    await tx.housekeepingTask.create({
      data: {
        roomId: input.roomId,
        status: 'PENDING',
        notes: `Share departure bed ${bed}, roommate remains`,
        jobType: 'STAYOVER',
      },
    });
  }
  return { doorCleared: false };
}

/** Block CRM gender change when live share stays lock a different pool gender. */
export async function assertGuestGenderChangeAllowed(
  guestId: string,
  nextGender: string | null | undefined,
) {
  const next = normalizeShareGender(nextGender);
  const live = await prisma.reservation.findMany({
    where: {
      guestId,
      shareEligible: true,
      status: { in: [...SCHEDULABLE_STATUSES] },
    },
    select: { id: true, shareGender: true, resNo: true },
  });
  for (const r of live) {
    const locked = normalizeShareGender(r.shareGender);
    if (locked && next !== locked) {
      throw new Error(
        `Cannot change guest gender while share stay is active (${r.resNo ?? r.id}) — break share or relocate first`,
      );
    }
  }
}

/** Union rooming queue: unassigned effective share stays FIFO by createdAt. */
export async function listShareRoomingQueue(input?: {
  roomTypeId?: string;
  gender?: ShareGender;
  limit?: number;
}) {
  const rows = await prisma.reservation.findMany({
    where: {
      shareEligible: true,
      shareGender: input?.gender ?? undefined,
      roomId: null,
      adults: 1,
      status: { in: ['CONFIRMED', 'OPTION'] },
      ...(input?.roomTypeId ? { roomTypeId: input.roomTypeId } : {}),
    },
    include: {
      guest: { select: { fullName: true, gender: true } },
      roomType: { select: { code: true, adultCapacity: true } },
      agency: { select: { code: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
    take: input?.limit ?? 50,
  });
  return rows.filter((r) => isEffectiveShare(r));
}

export async function suggestShareDoors(input: {
  reservationId: string;
  limit?: number;
}): Promise<
  Array<{
    roomId: string;
    roomNumber: string;
    floor: number;
    status: string;
    poolOccupancy: string;
    poolGender: ShareGender | null;
  }>
> {
  const reservation = await prisma.reservation.findUnique({
    where: { id: input.reservationId },
    include: { roomType: true, guest: { select: { gender: true } } },
  });
  if (!reservation) throw new Error('Reservation not found');
  if (!isEffectiveShare(reservation)) {
    throw new Error('Reservation is not share-eligible');
  }
  const gender = normalizeShareGender(reservation.shareGender)!;
  const maxBed = resolveMaxBed(null, reservation.roomType.adultCapacity);

  const rooms = await prisma.room.findMany({
    where: {
      roomTypeId: reservation.roomTypeId,
      disabled: false,
      deleted: false,
      status: { in: ['AVAILABLE', 'CLEAN', 'INSPECTED', 'OCCUPIED'] },
    },
    orderBy: [{ floor: 'asc' }, { roomNumber: 'asc' }],
  });

  const suggestions: Array<{
    roomId: string;
    roomNumber: string;
    floor: number;
    status: string;
    poolOccupancy: string;
    poolGender: ShareGender | null;
  }> = [];

  for (const room of rooms) {
    try {
      const { joiningPool } = await assertRoomShareAssignable({
        roomId: room.id,
        checkIn: reservation.checkInDate,
        checkOut: reservation.checkOutDate,
        excludeReservationId: reservation.id,
        candidate: {
          shareEligible: true,
          shareGender: gender,
          adults: 1,
          guestGender: reservation.guest?.gender,
        },
      });
      const overlapping = await prisma.reservation.findMany({
        where: {
          roomId: room.id,
          status: { in: [...SCHEDULABLE_STATUSES] },
          checkInDate: { lt: reservation.checkOutDate },
          checkOutDate: { gt: reservation.checkInDate },
        },
        select: { shareEligible: true, shareGender: true, adults: true, shareBedIndex: true },
      });
      const shareCount = overlapping.filter(isEffectiveShare).length;
      const poolGender =
        shareCount > 0 ? normalizeShareGender(overlapping.find(isEffectiveShare)?.shareGender ?? null) : null;
      if (poolGender && poolGender !== gender) continue;
      suggestions.push({
        roomId: room.id,
        roomNumber: room.roomNumber,
        floor: room.floor,
        status: room.status,
        poolOccupancy: shareCount > 0 ? `${shareCount}/${maxBed}` : `0/${maxBed}`,
        poolGender: poolGender ?? gender,
      });
      if (suggestions.length >= (input.limit ?? 10)) break;
    } catch {
      /* skip incompatible doors */
    }
  }

  return suggestions;
}

export function syncShareGenderFromGuest(
  shareEligible: boolean,
  guestGender: string | null | undefined,
): string | null {
  if (!shareEligible) return null;
  return normalizeShareGender(guestGender);
}

export { overlapsStay };
