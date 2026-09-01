/**
 * Elektraweb → ERA shared-twin mapping for Excel import and live bridge.
 *
 * EW marks only the second guest (Record Type SHARE / Room Count 0 / Room No …S).
 * The NORMAL primary on the same physical door must be pulled into the share pool.
 * EW NORMAL after first-out must never clear ERA shareEligible.
 */

import { isOtaAgency } from '@/lib/booking-source-kind';
import { reservationStayOverlaps } from '@/lib/hotel-calendar';
import {
  nextShareBedIndex,
  normalizeShareGender,
  resolveMaxBed,
  type ShareGender,
} from '@/lib/services/share-assignment.service';

/** Stay statuses that participate in door pairing (includes history for occupancy). */
export const SHARE_PAIR_STATUSES = [
  'OPTION',
  'CONFIRMED',
  'IN_HOUSE',
  'CHECKED_OUT',
] as const;

export type ElektrawebShareSignals = {
  /** Raw Room No from EW (may be 707S). */
  rawRoomNumber?: string | null;
  recordType?: string | null;
  roomCount?: number | null;
};

/**
 * Strip one trailing S/s only when the base is a numeric room number (707S → 707).
 * Does not treat garbage like `...S` as a share door.
 */
export function physicalRoomNumber(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim();
  if (!s) return null;
  if (/^[0-9]+[Ss]$/.test(s)) return s.slice(0, -1);
  return s;
}

/** True when EW list shows the virtual second-bed room label (707S). */
export function isShareRoomNumberSuffix(raw: string | null | undefined): boolean {
  return /^[0-9]+[Ss]$/.test((raw ?? '').trim());
}

export function parseElektrawebRecordType(value: unknown): string | null {
  if (value == null || value === '') return null;
  return String(value).trim().toUpperCase();
}

export function parseElektrawebRoomCount(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(String(value).replace(',', '.').replace(/\s/g, ''));
  return Number.isFinite(n) ? n : null;
}

/**
 * Second guest signal on this EW row.
 * Agency name is never a trigger — walk-in share uses the same SHARE / RC=0 / …S flags.
 */
export function isElektrawebShareSecond(signals: ElektrawebShareSignals): boolean {
  const recordType = parseElektrawebRecordType(signals.recordType);
  if (recordType === 'SHARE') return true;

  const door = physicalRoomNumber(signals.rawRoomNumber);
  const roomCount = signals.roomCount;
  if (door && roomCount === 0) return true;

  if (isShareRoomNumberSuffix(signals.rawRoomNumber)) return true;

  return false;
}

/** Map EW Gender / Title → M|F for shareGender snapshot. */
export function genderFromElektrawebGuest(input: {
  gender?: string | null;
  title?: string | null;
}): ShareGender | null {
  const fromGender = normalizeShareGender(input.gender);
  if (fromGender) return fromGender;
  const t = (input.title ?? '').trim().toUpperCase();
  if (!t) return null;
  if (/^(MR|MRS|MS|MISS|MALE|FEMALE|BAY|XANIM)\b/.test(t) || t === 'MR.' || t === 'MRS.') {
    if (t.startsWith('MR') && !t.startsWith('MRS') && !t.startsWith('MS')) return 'M';
    if (t.startsWith('MRS') || t.startsWith('MS') || t.startsWith('MISS') || t === 'XANIM') {
      return 'F';
    }
    if (t === 'BAY' || t === 'MALE') return 'M';
    if (t === 'FEMALE') return 'F';
  }
  return normalizeShareGender(t);
}

type ShareMapReservation = {
  id: string;
  roomId: string | null;
  adults: number;
  shareEligible: boolean;
  shareGender: string | null;
  shareBedIndex: number | null;
  checkInDate: Date;
  checkOutDate: Date;
  status: string;
  guest: { sex: string | null; title: string | null };
  agency: { code: string; name: string } | null;
  room: {
    id: string;
    maxBed: number | null;
    roomType: { adultCapacity: number | null };
  } | null;
};

type ShareMapNeighbor = {
  id: string;
  adults: number;
  shareEligible: boolean;
  shareGender: string | null;
  shareBedIndex: number | null;
  checkInDate: Date;
  checkOutDate: Date;
  guest: { sex: string | null; title: string | null };
  agency: { code: string; name: string } | null;
};

/** Minimal Prisma-shaped client (full client or import transaction). */
export type ShareMapDb = { reservation: Record<string, any> };

export type ApplyElektrawebSharePairInput = {
  reservationId: string;
  /** EW second-guest signal for this upsert. */
  isSecond: boolean;
  /** Optional EW ShareNo label (display only). */
  shareNo?: string | null;
  dryRun?: boolean;
};

export type ApplyElektrawebSharePairResult = {
  applied: boolean;
  pairedIds: string[];
  skippedReason?: string;
};

function canJoinSharePool(input: {
  adults: number;
  gender: string | null | undefined;
  title?: string | null;
  agencyCode?: string | null;
  agencyName?: string | null;
}): { ok: true; gender: ShareGender } | { ok: false; reason: string } {
  if (input.adults !== 1) {
    return { ok: false, reason: 'adults_not_1' };
  }
  if (input.agencyCode && isOtaAgency(input.agencyCode, input.agencyName)) {
    return { ok: false, reason: 'ota' };
  }
  const gender = genderFromElektrawebGuest({
    gender: input.gender,
    title: input.title,
  });
  if (!gender) {
    return { ok: false, reason: 'no_gender' };
  }
  return { ok: true, gender };
}

/**
 * After reservation upsert: if this row is an EW second guest, or an overlapping
 * share neighbor already exists on the door, mark the whole overlapping pool.
 * Never clears shareEligible when EW says NORMAL / Room Count 1.
 */
export async function applyElektrawebSharePair(
  db: ShareMapDb,
  input: ApplyElektrawebSharePairInput,
): Promise<ApplyElektrawebSharePairResult> {
  const reservation = await db.reservation.findUnique({
    where: { id: input.reservationId },
    include: {
      guest: true,
      agency: true,
      room: { include: { roomType: true } },
    },
  });
  if (!reservation?.roomId || !reservation.room) {
    return { applied: false, pairedIds: [], skippedReason: 'no_room' };
  }
  if (!SHARE_PAIR_STATUSES.includes(reservation.status as (typeof SHARE_PAIR_STATUSES)[number])) {
    return { applied: false, pairedIds: [], skippedReason: 'status_out' };
  }

  const overlapping = await db.reservation.findMany({
    where: {
      roomId: reservation.roomId,
      status: { in: [...SHARE_PAIR_STATUSES] },
      checkInDate: { lt: reservation.checkOutDate },
      checkOutDate: { gt: reservation.checkInDate },
    },
    include: {
      guest: { select: { sex: true, title: true } },
      agency: { select: { code: true, name: true } },
    },
  });

  const neighborShare = overlapping.some(
    (r: ShareMapNeighbor) => r.id !== reservation.id && r.shareEligible,
  );
  const overlapGated = overlapping.filter((row: ShareMapNeighbor) => {
    const gate = canJoinSharePool({
      adults: row.adults,
      gender: row.guest?.sex,
      title: row.guest?.title,
      agencyCode: row.agency?.code,
      agencyName: row.agency?.name,
    });
    return gate.ok && reservationStayOverlaps(row, reservation);
  });
  const overlapByGender = new Map<ShareGender, number>();
  for (const row of overlapGated) {
    const gate = canJoinSharePool({
      adults: row.adults,
      gender: row.guest?.sex,
      title: row.guest?.title,
      agencyCode: row.agency?.code,
      agencyName: row.agency?.name,
    });
    if (!gate.ok) continue;
    overlapByGender.set(gate.gender, (overlapByGender.get(gate.gender) ?? 0) + 1);
  }
  const overlapEligible = [...overlapByGender.values()].some((n) => n >= 2);
  const shouldOpenPool =
    input.isSecond || neighborShare || reservation.shareEligible || overlapEligible;

  if (!shouldOpenPool) {
    // Walk-in / exclusive NORMAL — leave alone; never clear existing share.
    if (input.shareNo != null && input.shareNo !== '' && !input.dryRun) {
      await db.reservation.update({
        where: { id: reservation.id },
        data: { shareNo: input.shareNo },
      });
    }
    return { applied: false, pairedIds: [], skippedReason: 'no_share_signal' };
  }

  type Member = {
    id: string;
    isSecondHint: boolean;
    gender: ShareGender;
    existingBed: number | null;
  };

  const gateFor = (row: ShareMapNeighbor | ShareMapReservation) =>
    canJoinSharePool({
      adults: row.adults,
      gender: row.guest?.sex,
      title: row.guest?.title,
      agencyCode: row.agency?.code,
      agencyName: row.agency?.name,
    });

  const byId = new Map<string, Member>();

  for (const row of overlapping) {
    const gate = gateFor(row);
    if (!gate.ok) continue;
    const isSelf = row.id === reservation.id;
    const pullAllEligible = input.isSecond || overlapEligible;
    const pullExistingShare = row.shareEligible || (isSelf && reservation.shareEligible);
    const pullSelfIntoNeighborPool = isSelf && neighborShare;
    if (!pullAllEligible && !pullExistingShare && !pullSelfIntoNeighborPool) continue;
    byId.set(row.id, {
      id: row.id,
      isSecondHint: isSelf ? input.isSecond : false,
      gender: gate.gender,
      existingBed: row.shareBedIndex,
    });
  }

  if (byId.size === 0) {
    const selfGate = gateFor(reservation);
    return {
      applied: false,
      pairedIds: [],
      skippedReason: selfGate.ok ? 'no_eligible_members' : selfGate.reason,
    };
  }

  // Prefer NORMAL (not second) on bed 1, then second guests.
  const ordered = [...byId.values()].sort((a, b) => {
    if (a.isSecondHint !== b.isSecondHint) return a.isSecondHint ? 1 : -1;
    return a.id.localeCompare(b.id);
  });

  const maxBed = resolveMaxBed(
    reservation.room.maxBed,
    reservation.room.roomType.adultCapacity,
  );

  const poolGender = ordered[0]!.gender;
  const compatible = ordered.filter((m) => m.gender === poolGender);
  if (compatible.length === 0) {
    return { applied: false, pairedIds: [], skippedReason: 'gender_mismatch' };
  }
  if (compatible.length > maxBed) {
    compatible.length = maxBed;
  }

  const assigned: Array<{ id: string; bed: number; gender: ShareGender }> = [];
  for (const m of compatible) {
    const bed =
      m.existingBed != null &&
      m.existingBed >= 1 &&
      m.existingBed <= maxBed &&
      !assigned.some((a) => a.bed === m.existingBed)
        ? m.existingBed
        : nextShareBedIndex(
            assigned.map((a) => ({ shareBedIndex: a.bed })),
            maxBed,
          );
    assigned.push({ id: m.id, bed, gender: poolGender });
  }

  if (input.dryRun) {
    return { applied: true, pairedIds: assigned.map((a) => a.id) };
  }

  for (const a of assigned) {
    await db.reservation.update({
      where: { id: a.id },
      data: {
        shareEligible: true,
        shareGender: a.gender,
        shareBedIndex: a.bed,
        ...(a.id === reservation.id && input.shareNo
          ? { shareNo: input.shareNo }
          : {}),
      },
    });
  }

  return { applied: true, pairedIds: assigned.map((a) => a.id) };
}

/** Extract share signals from an Elektraweb API / Excel-mapped row. */
export function elektrawebShareSignalsFromRow(
  row: Record<string, unknown>,
): ElektrawebShareSignals {
  const rawRoomNumber =
    (row.rawRoomNumber as string | null | undefined) ??
    (row.ROOMNO as string | null | undefined) ??
    (row.ROOMID_ROOMNO as string | null | undefined) ??
    (row.roomNumber as string | null | undefined) ??
    null;

  const recordType =
    row.recordType ??
    row.RECORDTYPE ??
    row.RESTYPE ??
    row.RESRECORDTYPE ??
    row.RECORD_TYPE ??
    null;

  const roomCountRaw =
    row.roomCount ??
    row.ROOMCOUNT ??
    row.ROOMCNT ??
    row.ROOM_COUNT ??
    row.ROOMCOUNTID ??
    null;

  return {
    rawRoomNumber: rawRoomNumber != null ? String(rawRoomNumber) : null,
    recordType: recordType != null ? String(recordType) : null,
    roomCount: parseElektrawebRoomCount(roomCountRaw),
  };
}
