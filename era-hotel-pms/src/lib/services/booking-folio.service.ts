import { prisma } from '@/lib/prisma';
import { satelliteOrganizationId } from '@era/satellite-kit';
import type { FolioType } from '@prisma/client';

/** Heuristic: room & tax vs extras for MASTER / SPLIT booking folio mode. */
export function isRoomAndTaxRevenueCode(code: {
  code: string;
  taxTag?: string | null;
  ratePlansRoom?: { id: string }[];
}): boolean {
  if (code.ratePlansRoom && code.ratePlansRoom.length > 0) return true;
  const tag = (code.taxTag ?? '').toUpperCase();
  if (tag === 'ROOM' || tag === 'ACCOM' || tag === 'LODGING') return true;
  return /^(ROOM|ACCOM|LODG|STAY)/i.test(code.code);
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
      organizationId: satelliteOrganizationId(),
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
          organizationId: satelliteOrganizationId(),
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
