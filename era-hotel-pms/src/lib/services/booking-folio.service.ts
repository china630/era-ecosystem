import { prisma } from '@/lib/prisma';
import { requestOrganizationId } from '@/lib/request-organization';
import type { FolioType } from '@prisma/client';
import { stayMoneyPair } from '@/lib/folio-money-pair';
import { revenueRoleIn, STAY_NIGHT_ROLES } from '@/lib/revenue-code-match';

/** Room & tax vs extras for MASTER / SPLIT booking folio mode. */
export function isRoomAndTaxRevenueCode(code: {
  systemRole: string | null;
  ratePlansRoom?: { id: string }[];
}): boolean {
  if (code.ratePlansRoom && code.ratePlansRoom.length > 0) return true;
  return revenueRoleIn(code, [...STAY_NIGHT_ROLES, 'CITY_TAX']);
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
/** One primary guest, and a folio for every guest on a live stay, including a child. */
export async function ensurePrimaryAndGuestFolios(reservationId: string) {
  const guests = await prisma.reservationGuest.findMany({
    where: { reservationId },
    orderBy: { sortOrder: 'asc' },
  });
  if (guests.length === 0) return;
  const primary = guests.find((row) => row.isPrimary) ?? guests[0]!;
  await prisma.reservationGuest.updateMany({
    where: { reservationId },
    data: { ownsFolio: true, isPrimary: false },
  });
  await prisma.reservationGuest.update({
    where: { id: primary.id },
    data: { isPrimary: true, ownsFolio: true },
  });
  await prisma.reservation.update({
    where: { id: reservationId },
    data: { partyBillingMode: 'PRIMARY' },
  });
  await ensurePartyGuestFolios(reservationId);
}

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

function partyPresent(
  type: FolioType,
  stay: { companyId: string | null; agencyId: string | null },
): boolean {
  if (type === 'COMPANY') return Boolean(stay.companyId);
  if (type === 'AGENCY') return Boolean(stay.agencyId);
  return true;
}

/**
 * Where a new charge goes when nobody typed a folio.
 * Stay route, then the hotel route, then company-on-this-room, then the primary guest.
 * A route to a company or agency that is not on this stay falls through.
 * A group master does not take the room.
 */
export async function resolveRoutedFolioType(input: {
  reservationId: string;
  revenueCodeId: string;
  explicit?: FolioType | null;
}): Promise<FolioType> {
  const stay = await prisma.reservation.findUnique({
    where: { id: input.reservationId },
    select: { companyId: true, agencyId: true },
  });
  if (!stay) throw new Error('Reservation not found');

  if (input.explicit && partyPresent(input.explicit, stay)) return input.explicit;

  const override = await prisma.reservationFolioRoutingOverride.findUnique({
    where: {
      reservationId_revenueCodeId: {
        reservationId: input.reservationId,
        revenueCodeId: input.revenueCodeId,
      },
    },
  });
  if (override && partyPresent(override.targetFolioType, stay)) return override.targetFolioType;

  const rule = await prisma.folioRoutingRule.findUnique({
    where: { revenueCodeId: input.revenueCodeId },
  });
  if (rule && partyPresent(rule.targetFolioType, stay)) return rule.targetFolioType;

  const revenueCode = await prisma.revenueCode.findUnique({
    where: { id: input.revenueCodeId },
    include: { ratePlansRoom: { select: { id: true }, take: 1 } },
  });
  if (revenueCode && isRoomAndTaxRevenueCode(revenueCode) && stay.companyId) return 'COMPANY';
  return 'GUEST';
}

async function ensureGuestFolio(reservationId: string, reservationGuestId: string) {
  const existing = await prisma.folio.findFirst({
    where: { reservationGuestId, reservationId, type: 'GUEST' },
  });
  if (existing) {
    if (existing.status !== 'OPEN') throw new Error('Guest folio is closed');
    return existing;
  }
  return prisma.folio.create({
    data: {
      organizationId: requestOrganizationId(),
      reservationId,
      reservationGuestId,
      type: 'GUEST',
      status: 'OPEN',
    },
  });
}

async function primaryGuestId(reservationId: string): Promise<string | null> {
  const marked = await prisma.reservationGuest.findFirst({
    where: { reservationId, isPrimary: true },
    orderBy: { sortOrder: 'asc' },
    select: { id: true },
  });
  if (marked) return marked.id;
  const first = await prisma.reservationGuest.findFirst({
    where: { reservationId },
    orderBy: { sortOrder: 'asc' },
    select: { id: true },
  });
  return first?.id ?? null;
}

/** Folio that receives a charge. Does not open a company or agency folio the stay does not have. */
export async function resolveChargeFolio(input: {
  reservationId: string;
  revenueCodeId: string;
  explicit?: FolioType | null;
  reservationGuestId?: string | null;
}) {
  const folioType = await resolveRoutedFolioType(input);
  const revenueCode = await prisma.revenueCode.findUnique({
    where: { id: input.revenueCodeId },
    include: { ratePlansRoom: { select: { id: true }, take: 1 } },
  });
  const roomTax = revenueCode ? isRoomAndTaxRevenueCode(revenueCode) : false;
  if (folioType === 'GUEST') {
    const guestId = !roomTax && input.reservationGuestId
      ? input.reservationGuestId
      : await primaryGuestId(input.reservationId);
    if (guestId) {
      const onStay = await prisma.reservationGuest.findFirst({
        where: { id: guestId, reservationId: input.reservationId },
        select: { id: true },
      });
      if (!onStay) throw new Error('Guest is not on this stay');
      return ensureGuestFolio(input.reservationId, guestId);
    }
  }
  return ensureOpenFolio(input.reservationId, folioType);
}

/**
 * Room payment follows the open room charge. Before the night is posted it follows the room route.
 * Any other article uses the route, then the guest the cashier named.
 */
export async function resolvePaymentFolio(input: {
  reservationId: string;
  revenueCodeId: string;
  explicit?: FolioType | null;
  reservationGuestId?: string | null;
}) {
  const revenueCode = await prisma.revenueCode.findUnique({
    where: { id: input.revenueCodeId },
    include: { ratePlansRoom: { select: { id: true }, take: 1 } },
  });
  const roomTax = revenueCode ? isRoomAndTaxRevenueCode(revenueCode) : false;
  if (roomTax) {
    const folios = await prisma.folio.findMany({
      where: { reservationId: input.reservationId, status: 'OPEN' },
      include: { charges: true, payments: true },
    });
    const articleCharges = (folio: (typeof folios)[number]) =>
      folio.charges.filter((row) => row.revenueCodeId === input.revenueCodeId);
    const articlePayments = (folio: (typeof folios)[number]) =>
      folio.payments.filter((row) => row.revenueCodeId === input.revenueCodeId);
    const withDebt = folios.find(
      (folio) => stayMoneyPair(articleCharges(folio), articlePayments(folio)).debt > 0.01,
    );
    if (withDebt) return withDebt;
    const withCharge = folios.find((folio) => articleCharges(folio).length > 0);
    if (withCharge) return withCharge;
    return resolveChargeFolio({
      reservationId: input.reservationId,
      revenueCodeId: input.revenueCodeId,
    });
  }
  return resolveChargeFolio(input);
}
