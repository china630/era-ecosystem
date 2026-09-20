import type { ImportTx } from '@/lib/import/types';
import {
  getGuestImportNameLookup,
  planReservationPaxFromParts,
  splitReservationGuestParts,
  type PlannedImportPaxRow,
} from '@/lib/import/resolve-reservation-guest';

export type { PlannedImportPaxRow };

function splitDisplayName(displayName: string): {
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
} {
  const tokens = displayName.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return { firstName: null, middleName: null, lastName: null };
  if (tokens.length === 1) return { firstName: tokens[0] ?? null, middleName: null, lastName: null };
  return {
    firstName: tokens[0] ?? null,
    middleName: tokens.length > 2 ? tokens.slice(1, -1).join(' ') : null,
    lastName: tokens[tokens.length - 1] ?? null,
  };
}

async function loadGuestLookup(tx: ImportTx): Promise<Map<string, Set<string>>> {
  return getGuestImportNameLookup(tx);
}

export async function planReservationPaxForImport(
  tx: ImportTx,
  input: {
    primaryGuestId: string;
    guestName?: string | null;
  },
): Promise<PlannedImportPaxRow[]> {
  const parts = splitReservationGuestParts(input.guestName);
  const lookup = await loadGuestLookup(tx);
  return planReservationPaxFromParts(parts, input.primaryGuestId, lookup);
}

/** Replace ReservationGuest party from FO `Guest Name` (`A / B`) after reservation upsert. */
export async function syncReservationPaxFromImport(
  tx: ImportTx,
  reservationId: string,
  input: {
    primaryGuestId: string;
    guestName?: string | null;
  },
): Promise<{ paxCount: number; linkedCount: number }> {
  const planned = await planReservationPaxForImport(tx, input);
  const guestIds = [...new Set(planned.map((row) => row.guestId).filter(Boolean))] as string[];
  const guests =
    guestIds.length > 0
      ? await tx.guest.findMany({
          where: { id: { in: guestIds } },
          select: {
            id: true,
            firstName: true,
            middleName: true,
            lastName: true,
            sex: true,
            nationality: true,
            birthDate: true,
            documents: {
              select: { docType: true, docNumber: true, isPrimary: true },
              orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
              take: 8,
            },
          },
        })
      : [];
  const guestById = new Map(guests.map((g) => [g.id, g]));

  await tx.reservationGuest.deleteMany({ where: { reservationId } });
  await tx.reservationGuest.createMany({
    data: planned.map((row) => {
      const guest = row.guestId ? guestById.get(row.guestId) : undefined;
      const parsed = splitDisplayName(row.displayName);
      const passport =
        guest?.documents.find((d) =>
          String(d.docType ?? '').toUpperCase().includes('PASSPORT'),
        )?.docNumber ??
        guest?.documents.find((d) => d.isPrimary)?.docNumber ??
        guest?.documents.find((d) => d.docNumber?.trim())?.docNumber ??
        null;
      return {
        reservationId,
        guestId: row.guestId,
        firstName: guest?.firstName ?? parsed.firstName,
        middleName: guest?.middleName ?? parsed.middleName,
        lastName: guest?.lastName ?? parsed.lastName,
        sex: guest?.sex ?? null,
        nationality: guest?.nationality ?? null,
        birthDate: guest?.birthDate ?? null,
        passportNo: passport,
        isPrimary: row.isPrimary,
        ownsFolio: row.isPrimary,
        sortOrder: row.sortOrder,
      };
    }),
  });

  return {
    paxCount: planned.length,
    linkedCount: planned.filter((row) => row.guestId).length,
  };
}
