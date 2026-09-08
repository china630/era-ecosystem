/**
 * Idempotent backfill: overlapping schedulable stays on one door → share pool.
 * Usage:
 *   npx tsx scripts/ops/pair-share-overlaps.ts [--dry-run]
 *   npx tsx scripts/ops/pair-share-overlaps.ts --include-checked-out [--dry-run]
 */
import { PrismaClient } from '@prisma/client';
import { isOtaAgency } from '../../src/lib/booking-source-kind';
import { reservationStayOverlaps } from '../../src/lib/hotel-calendar';
import { SHARE_PAIR_STATUSES } from '../../src/lib/integration/elektraweb-share-map';
import {
  SCHEDULABLE_STATUSES,
  canGuestJoinSharePool,
  openSharePoolForDoor,
  type ShareGender,
} from '../../src/lib/services/share-assignment.service';

const dryRun = process.argv.includes('--dry-run');
const includeCheckedOut = process.argv.includes('--include-checked-out');
const statuses = includeCheckedOut ? [...SHARE_PAIR_STATUSES] : [...SCHEDULABLE_STATUSES];
const prisma = new PrismaClient();

type Row = {
  id: string;
  roomId: string;
  adults: number;
  shareEligible: boolean;
  shareGender: string | null;
  checkInDate: Date;
  checkOutDate: Date;
  guest: { sex: string | null };
  agency: { code: string; name: string } | null;
  room: { roomNumber: string } | null;
};

function gateRow(row: Row) {
  return canGuestJoinSharePool({
    adults: row.adults,
    shareGender: row.shareGender,
    guestGender: row.guest.sex,
    isOta: row.agency ? isOtaAgency(row.agency.code, row.agency.name) : false,
  });
}

async function main() {
  const rows = await prisma.reservation.findMany({
    where: {
      roomId: { not: null },
      status: { in: [...statuses] },
    },
    select: {
      id: true,
      roomId: true,
      adults: true,
      shareEligible: true,
      shareGender: true,
      checkInDate: true,
      checkOutDate: true,
      guest: { select: { sex: true } },
      agency: { select: { code: true, name: true } },
      room: { select: { roomNumber: true } },
    },
  });

  const byRoom = new Map<string, Row[]>();
  for (const r of rows) {
    if (!r.roomId) continue;
    const list = byRoom.get(r.roomId) ?? [];
    list.push(r as Row);
    byRoom.set(r.roomId, list);
  }

  let groups = 0;
  let opened = 0;
  let skipped = 0;

  for (const [roomId, doorRows] of byRoom) {
    const clusters = new Map<string, Row[]>();
    for (const a of doorRows) {
      const aGate = gateRow(a);
      if (!aGate.ok) continue;
      const mates = doorRows.filter((b) => {
        if (b.id === a.id || !reservationStayOverlaps(a, b)) return false;
        const bGate = gateRow(b);
        return bGate.ok && bGate.gender === aGate.gender;
      });
      if (mates.length === 0) continue;
      const ids = [a.id, ...mates.map((m) => m.id)].sort();
      const key = ids.join('|');
      if (!clusters.has(key)) {
        clusters.set(key, [a, ...mates]);
      }
    }

    for (const [, members] of clusters) {
      const unique = [...new Map(members.map((m) => [m.id, m])).values()];
      if (unique.length < 2) continue;
      if (unique.every((m) => m.shareEligible && m.shareGender)) {
        skipped += 1;
        continue;
      }
      groups += 1;
      const roomNumber = unique[0]?.room?.roomNumber ?? roomId;
      const gender = gateRow(unique[0]!);
      if (!gender.ok) {
        console.log(`SKIP ${roomNumber}: ${gender.reason}`, unique.map((u) => u.id));
        skipped += 1;
        continue;
      }
      const anchor = unique.reduce((min, r) => (r.checkInDate < min.checkInDate ? r : min));
      const windowEnd = unique.reduce(
        (max, r) => (r.checkOutDate > max ? r.checkOutDate : max),
        anchor.checkOutDate,
      );
      const assigned = await openSharePoolForDoor({
        roomId,
        checkIn: anchor.checkInDate,
        checkOut: windowEnd,
        poolGender: gender.gender,
        reservationIds: unique.map((u) => u.id),
        dryRun,
      });
      opened += 1;
      console.log(
        `${dryRun ? 'DRY' : 'OK'} room ${roomNumber}: paired ${assigned.map((a) => `${a.id}→bed${a.shareBedIndex}`).join(', ')}`,
      );
    }
  }

  console.log(
    `Done (${includeCheckedOut ? 'incl CHECKED_OUT' : 'schedulable only'}): ${groups} overlap group(s), ${opened} pool(s) opened, ${skipped} skipped`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
