import { prisma } from '@/lib/prisma';
import { requestOrganizationId } from '@/lib/request-organization';
import type { FolioType } from '@prisma/client';
import { matchesAnyRevenueToken } from '@/lib/revenue-code-token';

/** Heuristic: room & tax vs extras for MASTER / SPLIT booking folio mode. */
export function isRoomAndTaxRevenueCode(code: {
  code: string;
  name?: string | null;
  taxTag?: string | null;
  ratePlansRoom?: { id: string }[];
}): boolean {
  if (code.ratePlansRoom && code.ratePlansRoom.length > 0) return true;
  const tag = (code.taxTag ?? '').toUpperCase();
  if (tag === 'ROOM' || tag === 'ACCOM' || tag === 'LODGING') return true;
  if (/^(ROOM|ACCOM|LODG|STAY)/i.test(code.code)) return true;
  return matchesAnyRevenueToken(code, ['ROOM', 'ACCOM', 'LODGING', 'STAY']);
}

/** First active stay in the booking = master folio owner (variant A). */
export async function resolveBookingMasterReservationId(groupId: string): Promise<string | null> {
  const stay = await prisma.reservation.findFirst({
    where: {
      groupId,
      status: { notIn: ['CANCELLED', 'NO_SHOW'] },
    },
    orderBy: [{ checkInDate: 'asc' }, { createdAt: 'asc' }],
    select: { id: true },
  });
  return stay?.id ?? null;
}

export async function ensureOpenFolio(reservationId: string, type: FolioType) {
  const existing = await prisma.folio.findFirst({
    where: { reservationId, type, status: 'OPEN' },
  });
  if (existing) return existing;
  return prisma.folio.create({
    data: {
      organizationId: requestOrganizationId(),
      reservationId,
      type,
      status: 'OPEN',
    },
  });
}

/**
 * EQUAL party billing: ensure each ReservationGuest with ownsFolio has an OPEN GUEST folio
 * linked via reservationGuestId.
 */
export async function ensurePartyGuestFolios(reservationId: string) {
  const guests = await prisma.reservationGuest.findMany({
    where: { reservationId, ownsFolio: true },
    select: { id: true },
  });
  const created = [];
  for (const g of guests) {
    const existing = await prisma.folio.findFirst({
      where: {
        reservationId,
        reservationGuestId: g.id,
        type: 'GUEST',
        status: 'OPEN',
      },
    });
    if (existing) {
      created.push(existing);
      continue;
    }
    created.push(
      await prisma.folio.create({
        data: {
          organizationId: requestOrganizationId(),
          reservationId,
          reservationGuestId: g.id,
          type: 'GUEST',
          status: 'OPEN',
        },
      }),
    );
  }
  return created;
}

function partyNameKey(row: { firstName: string | null; lastName: string | null }): string {
  return [row.firstName, row.lastName].filter(Boolean).join(' ').trim().toLowerCase();
}

/**
 * After the party rows are rewritten, keep each guest folio on the new row.
 * A demoted guest keeps a folio that already has charges or payments.
 * An empty folio of someone who no longer owns one is removed.
 */
export async function reconcilePartyFolios(input: {
  reservationId: string;
  previous: Array<{
    guestId: string | null;
    firstName: string | null;
    lastName: string | null;
    folio: {
      id: string;
      charges: { id: string }[];
      payments: { id: string }[];
      deposits: { id: string }[];
    } | null;
  }>;
  next: Array<{
    id: string;
    guestId: string | null;
    firstName: string | null;
    lastName: string | null;
    ownsFolio: boolean;
  }>;
}) {
  for (const prev of input.previous) {
    const folio = prev.folio;
    if (!folio) continue;
    const prevKey = partyNameKey(prev);
    const match =
      input.next.find((row) => prev.guestId && row.guestId === prev.guestId) ??
      input.next.find((row) => prevKey.length > 0 && partyNameKey(row) === prevKey);
    const empty =
      folio.charges.length === 0 && folio.payments.length === 0 && folio.deposits.length === 0;
    if (!match || (!match.ownsFolio && empty)) {
      if (empty) await prisma.folio.delete({ where: { id: folio.id } });
      continue;
    }
    await prisma.folio.update({
      where: { id: folio.id },
      data: { reservationGuestId: match.id },
    });
  }

  const personal = await prisma.folio.count({
    where: {
      reservationId: input.reservationId,
      type: 'GUEST',
      reservationGuestId: { not: null },
      status: 'OPEN',
    },
  });
  if (personal < 2) return;
  const loose = await prisma.folio.findMany({
    where: {
      reservationId: input.reservationId,
      type: 'GUEST',
      reservationGuestId: null,
      status: 'OPEN',
    },
    include: {
      charges: { select: { id: true } },
      payments: { select: { id: true } },
      deposits: { select: { id: true } },
    },
  });
  for (const folio of loose) {
    if (folio.charges.length === 0 && folio.payments.length === 0 && folio.deposits.length === 0) {
      await prisma.folio.delete({ where: { id: folio.id } });
    }
  }
}

/**
 * Resolve which reservation+folioType receives a charge under booking folioMode.
 * INDIVIDUAL → null (caller uses default).
 * MASTER / SPLIT → room&tax to AGENCY (or COMPANY) on master stay; extras on source stay GUEST.
 */
export async function resolveBookingChargeTarget(input: {
  reservationId: string;
  revenueCodeId: string;
}): Promise<{ reservationId: string; folioType: FolioType } | null> {
  const reservation = await prisma.reservation.findUnique({
    where: { id: input.reservationId },
    select: {
      id: true,
      groupId: true,
      agencyId: true,
      guest: { select: { voen: true } },
      group: { select: { id: true, folioMode: true, agencyId: true } },
    },
  });
  if (!reservation?.groupId || !reservation.group) return null;
  const mode = reservation.group.folioMode;
  if (mode === 'INDIVIDUAL') return null;

  const revenueCode = await prisma.revenueCode.findUnique({
    where: { id: input.revenueCodeId },
    include: { ratePlansRoom: { select: { id: true }, take: 1 } },
  });
  if (!revenueCode) return null;

  const roomTax = isRoomAndTaxRevenueCode(revenueCode);

  if (mode === 'SPLIT' && !roomTax) {
    const rule = await prisma.folioRoutingRule.findUnique({
      where: { revenueCodeId: input.revenueCodeId },
    });
    if (rule) {
      return { reservationId: input.reservationId, folioType: rule.targetFolioType };
    }
    return { reservationId: input.reservationId, folioType: 'GUEST' };
  }

  if (roomTax) {
    const masterId =
      (await resolveBookingMasterReservationId(reservation.groupId)) ?? input.reservationId;
    const masterFolioType: FolioType =
      reservation.group.agencyId || reservation.agencyId
        ? 'AGENCY'
        : reservation.guest.voen
          ? 'COMPANY'
          : 'GUEST';
    return { reservationId: masterId, folioType: masterFolioType };
  }

  return { reservationId: input.reservationId, folioType: 'GUEST' };
}
