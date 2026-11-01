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

/** One primary guest, and a folio for every guest still in the room, including a child. */
export async function ensurePrimaryAndGuestFolios(reservationId: string) {
  const guests = await prisma.reservationGuest.findMany({
    where: { reservationId },
    orderBy: { sortOrder: 'asc' },
  });
  const live = guests.filter((row) => row.departedAt == null && row.guestState !== 'DEPARTED');
  await prisma.reservationGuest.updateMany({
    where: {
      reservationId,
      OR: [{ departedAt: { not: null } }, { guestState: 'DEPARTED' }],
    },
    data: { ownsFolio: false, isPrimary: false },
  });
  if (live.length === 0) return;
  const primary = live.find((row) => row.isPrimary) ?? live[0]!;
  await prisma.reservationGuest.updateMany({
    where: { reservationId, departedAt: null, NOT: { guestState: 'DEPARTED' } },
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
    where: { reservationId, ownsFolio: true, departedAt: null, NOT: { guestState: 'DEPARTED' } },
    select: { id: true },
  });
  const created = [];
  for (const g of guests) {
    const existing = await prisma.folio.findFirst({
      where: {
        reservationId,
        reservationGuestId: g.id,
        type: 'GUEST',
      },
    });
    // A closed folio still holds the unique reservationGuestId. Do not insert a second row.
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
  await foldLooseGuestFolioOntoPrimary(reservationId);
  return created;
}

async function mergeGuestFolioOnto(targetId: string, sourceId: string) {
  if (targetId === sourceId) return;
  await prisma.$transaction(async (tx) => {
    await tx.folioCharge.updateMany({ where: { folioId: sourceId }, data: { folioId: targetId } });
    await tx.folioPayment.updateMany({ where: { folioId: sourceId }, data: { folioId: targetId } });
    await tx.folioDeposit.updateMany({ where: { folioId: sourceId }, data: { folioId: targetId } });
    await tx.folioSettlement.updateMany({ where: { folioId: sourceId }, data: { folioId: targetId } });
    await tx.fiscalDocument.updateMany({ where: { folioId: sourceId }, data: { folioId: targetId } });
    await tx.cardAuthorization.updateMany({ where: { folioId: sourceId }, data: { folioId: targetId } });
    await tx.folio.delete({ where: { id: sourceId } });
  });
}

/**
 * One person = one open guest pocket.
 * Loose (no guest id) folios fold onto the primary guest folio.
 * Extra open folios for the same reservationGuestId fold onto the oldest open one.
 */
export async function foldLooseGuestFolioOntoPrimary(reservationId: string) {
  const primary = await prisma.reservationGuest.findFirst({
    where: {
      reservationId,
      isPrimary: true,
      departedAt: null,
      NOT: { guestState: 'DEPARTED' },
    },
    select: { id: true },
  });
  if (primary) {
    let target = await prisma.folio.findFirst({
      where: {
        reservationId,
        type: 'GUEST',
        reservationGuestId: primary.id,
        status: 'OPEN',
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!target) {
      const looseFirst = await prisma.folio.findFirst({
        where: {
          reservationId,
          type: 'GUEST',
          reservationGuestId: null,
          status: 'OPEN',
        },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      if (looseFirst) {
        await prisma.folio.update({
          where: { id: looseFirst.id },
          data: { reservationGuestId: primary.id },
        });
        target = looseFirst;
      }
    }
    if (target) {
      const loose = await prisma.folio.findMany({
        where: {
          reservationId,
          type: 'GUEST',
          reservationGuestId: null,
          status: 'OPEN',
          NOT: { id: target.id },
        },
        select: { id: true },
      });
      for (const folio of loose) {
        await mergeGuestFolioOnto(target.id, folio.id);
      }
    }
  }

  const openGuest = await prisma.folio.findMany({
    where: {
      reservationId,
      type: 'GUEST',
      status: 'OPEN',
      reservationGuestId: { not: null },
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true, reservationGuestId: true },
  });
  const byGuest = new Map<string, string[]>();
  for (const folio of openGuest) {
    const guestId = folio.reservationGuestId!;
    const list = byGuest.get(guestId) ?? [];
    list.push(folio.id);
    byGuest.set(guestId, list);
  }
  for (const ids of byGuest.values()) {
    if (ids.length < 2) continue;
    const keep = ids[0]!;
    for (const extra of ids.slice(1)) {
      await mergeGuestFolioOnto(keep, extra);
    }
  }
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

  await foldLooseGuestFolioOntoPrimary(input.reservationId);
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
 * Stay route, then the hotel route, then the stay roomPayer for ROOM/tax, then the primary guest.
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
    select: { companyId: true, agencyId: true, roomPayer: true },
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
  if (revenueCode && isRoomAndTaxRevenueCode(revenueCode)) {
    if (stay.roomPayer === 'COMPANY' && stay.companyId) return 'COMPANY';
    if (stay.roomPayer === 'AGENCY' && stay.agencyId) return 'AGENCY';
    // Legacy stays: company on the card without an explicit roomPayer still takes ROOM.
    if (stay.roomPayer === 'GUEST' && stay.companyId && !stay.agencyId) return 'COMPANY';
    return 'GUEST';
  }
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

/**
 * Accept payment for an article across the stay: lodging debts are paid FIFO
 * across open folios (one lodging bill). Extras stay on the resolved pocket.
 */
export async function postStayArticlePayment(input: {
  reservationId: string;
  revenueCodeId: string;
  amount: number;
  paymentMethod: Parameters<typeof import('@/lib/services/folio.service').postPayment>[0]['paymentMethod'];
  registerRef?: string;
  bankReference?: string;
  bankTerminalId?: string;
  explicit?: FolioType | null;
  reservationGuestId?: string | null;
  allowCredit?: boolean;
  createdByUserId?: string;
  auditRequest?: Request;
}) {
  const { postPayment } = await import('@/lib/services/folio.service');
  const revenueCode = await prisma.revenueCode.findUnique({
    where: { id: input.revenueCodeId },
    include: { ratePlansRoom: { select: { id: true }, take: 1 } },
  });
  const lodging = revenueCode ? isRoomAndTaxRevenueCode(revenueCode) : false;

  if (!lodging) {
    const folio = await resolvePaymentFolio({
      reservationId: input.reservationId,
      revenueCodeId: input.revenueCodeId,
      explicit: input.explicit,
      reservationGuestId: input.reservationGuestId,
    });
    return postPayment({
      folioId: folio.id,
      amount: input.amount,
      paymentMethod: input.paymentMethod,
      registerRef: input.registerRef,
      bankReference: input.bankReference,
      bankTerminalId: input.bankTerminalId,
      revenueCodeId: input.revenueCodeId,
      allowCredit: input.allowCredit,
      createdByUserId: input.createdByUserId,
      auditRequest: input.auditRequest,
    });
  }

  const folios = await prisma.folio.findMany({
    where: { reservationId: input.reservationId, status: 'OPEN' },
    include: { charges: true, payments: true },
  });
  const pocketRank = (type: string) =>
    type === 'AGENCY' ? 0 : type === 'COMPANY' ? 1 : type === 'GUEST' ? 2 : 3;
  const ranked = folios
    .map((folio) => ({
      folio,
      debt: stayMoneyPair(
        folio.charges.filter((row) => row.revenueCodeId === input.revenueCodeId),
        folio.payments.filter((row) => row.revenueCodeId === input.revenueCodeId),
      ).debt,
    }))
    .filter((row) => row.debt > 0.01)
    .sort((a, b) => {
      const pocket = pocketRank(a.folio.type) - pocketRank(b.folio.type);
      if (pocket !== 0) return pocket;
      return b.debt - a.debt;
    });

  let left = input.amount;
  let last = null as Awaited<ReturnType<typeof postPayment>> | null;
  for (const row of ranked) {
    if (left <= 0.01) break;
    const take = Math.min(left, row.debt);
    last = await postPayment({
      folioId: row.folio.id,
      amount: take,
      paymentMethod: input.paymentMethod,
      registerRef: input.registerRef,
      bankReference: input.bankReference,
      bankTerminalId: input.bankTerminalId,
      revenueCodeId: input.revenueCodeId,
      allowCredit: false,
      createdByUserId: input.createdByUserId,
      auditRequest: input.auditRequest,
    });
    left -= take;
  }
  if (left > 0.01) {
    const fallback =
      ranked[0]?.folio ??
      (await resolvePaymentFolio({
        reservationId: input.reservationId,
        revenueCodeId: input.revenueCodeId,
      }));
    last = await postPayment({
      folioId: fallback.id,
      amount: left,
      paymentMethod: input.paymentMethod,
      registerRef: input.registerRef,
      bankReference: input.bankReference,
      bankTerminalId: input.bankTerminalId,
      revenueCodeId: input.revenueCodeId,
      allowCredit: input.allowCredit === true,
      createdByUserId: input.createdByUserId,
      auditRequest: input.auditRequest,
    });
  }
  if (!last) throw new Error('No open folio for payment');
  return last;
}

/** Accept payment for a cashier category on one pocket. */
export async function postStayCategoryPayment(input: {
  reservationId: string;
  paymentCategory: string;
  amount: number;
  paymentMethod: Parameters<typeof import('@/lib/services/folio.service').postPayment>[0]['paymentMethod'];
  registerRef?: string;
  bankReference?: string;
  bankTerminalId?: string;
  folioType?: FolioType | null;
  reservationGuestId?: string | null;
  createdByUserId?: string;
  auditRequest?: Request;
}) {
  const { isPaymentCategory } = await import('@/lib/payment-category');
  if (!isPaymentCategory(input.paymentCategory)) {
    throw new Error('PAYMENT_CATEGORY_REQUIRED');
  }
  const { postPayment } = await import('@/lib/services/folio.service');

  let folio;
  if (input.folioType === 'COMPANY' || input.folioType === 'AGENCY') {
    folio = await ensureOpenFolio(input.reservationId, input.folioType);
  } else {
    const guestId = input.reservationGuestId ?? (await primaryGuestId(input.reservationId));
    if (!guestId) throw new Error('Guest folio required');
    folio = await ensureGuestFolio(input.reservationId, guestId);
  }

  await foldLooseGuestFolioOntoPrimary(input.reservationId);
  const refreshed = await prisma.folio.findUnique({ where: { id: folio.id } });
  if (!refreshed || refreshed.status !== 'OPEN') {
    throw new Error('Folio is not open');
  }

  return postPayment({
    folioId: refreshed.id,
    amount: input.amount,
    paymentMethod: input.paymentMethod,
    registerRef: input.registerRef,
    bankReference: input.bankReference,
    bankTerminalId: input.bankTerminalId,
    paymentCategory: input.paymentCategory,
    allowCredit: true,
    createdByUserId: input.createdByUserId,
    auditRequest: input.auditRequest,
  });
}

/**
 * Mid-stay cash/card return of unused credit in one cashier category on one pocket.
 * FIFO against category payments; never pulls lodging credit to cover a clinic refund.
 */
export async function refundStayCategoryCredit(input: {
  reservationId: string;
  paymentCategory: string;
  amount: number;
  reason: string;
  paymentMethod?: 'CASH' | 'CARD';
  bankTerminalId?: string;
  folioType?: FolioType | null;
  reservationGuestId?: string | null;
  createdByUserId?: string;
  auditRequest?: Request;
}) {
  const { isPaymentCategory, resolvePaymentCategory } = await import('@/lib/payment-category');
  const { stayCategoryMoneyPair } = await import('@/lib/folio-money-pair');
  const { refundFolioPayment } = await import('@/lib/services/folio-refund.service');
  const { decimalToNumber } = await import('@/lib/decimal');

  if (!isPaymentCategory(input.paymentCategory)) {
    throw Object.assign(new Error('PAYMENT_CATEGORY_REQUIRED'), {
      status: 400,
      code: 'PAYMENT_CATEGORY_REQUIRED',
    });
  }
  const reason = input.reason.trim();
  if (!reason) {
    throw Object.assign(new Error('REFUND_REASON_REQUIRED'), {
      status: 400,
      code: 'REFUND_REASON_REQUIRED',
    });
  }
  if (!(input.amount > 0.01)) {
    throw new Error('Refund amount must be positive');
  }

  let folio;
  if (input.folioType === 'COMPANY' || input.folioType === 'AGENCY') {
    folio = await ensureOpenFolio(input.reservationId, input.folioType);
  } else {
    const guestId = input.reservationGuestId ?? (await primaryGuestId(input.reservationId));
    if (!guestId) throw new Error('Guest folio required');
    folio = await ensureGuestFolio(input.reservationId, guestId);
  }

  await foldLooseGuestFolioOntoPrimary(input.reservationId);
  const loaded = await prisma.folio.findUnique({
    where: { id: folio.id },
    include: { charges: true, payments: true },
  });
  if (!loaded || loaded.status !== 'OPEN') {
    throw new Error('Folio is not open');
  }

  const unused = stayCategoryMoneyPair(
    loaded.charges,
    loaded.payments,
    input.paymentCategory,
  ).unused;
  if (unused <= 0.01) {
    throw Object.assign(new Error('PAYMENT_CATEGORY_NO_UNUSED'), {
      status: 409,
      code: 'PAYMENT_CATEGORY_NO_UNUSED',
    });
  }
  if (input.amount > unused + 0.01) {
    throw Object.assign(
      new Error(`PAYMENT_CATEGORY_REFUND_EXCEEDS:${unused.toFixed(2)}`),
      {
        status: 409,
        code: 'PAYMENT_CATEGORY_REFUND_EXCEEDS',
        max: unused,
      },
    );
  }

  const ranked = loaded.payments
    .filter(
      (row) =>
        !row.voidedAt &&
        row.kind === 'PAYMENT' &&
        resolvePaymentCategory(row) === input.paymentCategory,
    )
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  let left = Math.round(input.amount * 100) / 100;
  const posted: Awaited<ReturnType<typeof refundFolioPayment>>[] = [];
  for (const payment of ranked) {
    if (left <= 0.01) break;
    const already = await prisma.folioPayment.aggregate({
      where: { refundOfPaymentId: payment.id, kind: 'REFUND' },
      _sum: { amount: true },
    });
    const refundedSoFar =
      already._sum.amount != null ? decimalToNumber(already._sum.amount) : 0;
    const remaining = decimalToNumber(payment.amount) - refundedSoFar;
    if (remaining <= 0.01) continue;
    const take = Math.min(left, remaining);
    const row = await refundFolioPayment({
      paymentId: payment.id,
      amount: take,
      reason,
      paymentMethod: input.paymentMethod,
      bankTerminalId: input.bankTerminalId,
      createdByUserId: input.createdByUserId,
      auditRequest: input.auditRequest,
    });
    posted.push(row);
    left = Math.round((left - take) * 100) / 100;
  }

  if (left > 0.01) {
    throw Object.assign(new Error('PAYMENT_CATEGORY_NO_UNUSED'), {
      status: 409,
      code: 'PAYMENT_CATEGORY_NO_UNUSED',
    });
  }
  return posted;
}
