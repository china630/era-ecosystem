import { prisma } from '@/lib/prisma';
import { decimalToNumber } from '@/lib/decimal';
import { folioBalance } from '@/lib/services/folio.service';
import { findActiveSalesContract } from '@/lib/services/sales-contract.service';

export type CityLedgerCounterparty = {
  agencyId?: string | null;
  companyGuestId?: string | null;
};

/**
 * Sum of open AR exposure for agency (PENDING_AR + TRANSFERRED_AR folio balances).
 */
export async function counterpartyOpenArExposure(input: {
  agencyId?: string | null;
  companyId?: string | null;
}): Promise<number> {
  if (input.companyId) {
    const folios = await prisma.folio.findMany({
      where: {
        status: { in: ['PENDING_AR', 'TRANSFERRED_AR'] },
        type: 'COMPANY',
        reservation: { companyId: input.companyId },
      },
      include: { charges: true, payments: true },
    });
    return folios.reduce((s, f) => s + folioBalance(f.charges, f.payments), 0);
  }
  if (!input.agencyId) return 0;
  // Agency exposure: AGENCY folios for this agency, plus COMPANY folios on stays that carry this agencyId.
  const folios = await prisma.folio.findMany({
    where: {
      status: { in: ['PENDING_AR', 'TRANSFERRED_AR'] },
      reservation: { agencyId: input.agencyId },
      OR: [{ type: 'AGENCY' }, { type: 'COMPANY' }],
    },
    include: { charges: true, payments: true },
  });
  return folios.reduce((s, f) => s + folioBalance(f.charges, f.payments), 0);
}

/**
 * Effective credit limit: stay → agency/company card → hotel default.
 * Prefer party when known; otherwise agency (legacy callers).
 */
export async function resolveEffectiveCreditLimit(
  reservationId: string,
  party: 'AGENCY' | 'COMPANY' = 'AGENCY',
): Promise<number | null> {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      agency: { select: { creditLimitAzn: true } },
      company: { select: { creditLimitAzn: true } },
    },
  });
  if (!reservation) return null;
  if (reservation.creditLimitAzn != null) return decimalToNumber(reservation.creditLimitAzn);
  const card =
    party === 'COMPANY' ? reservation.company?.creditLimitAzn : reservation.agency?.creditLimitAzn;
  if (card != null) return decimalToNumber(card);
  const profile = await prisma.hotelProfile.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { defaultCreditLimitAzn: true },
  });
  if (profile?.defaultCreditLimitAzn != null) {
    return decimalToNumber(profile.defaultCreditLimitAzn);
  }
  return null;
}

/**
 * Gate: ACTIVE sales contract (on stay or for agency) + credit limit covers exposure + transfer.
 */
export async function assertCanTransferToCityLedger(
  reservationId: string,
  folioId: string,
  transferAmount: number,
): Promise<void> {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      agency: true,
      company: true,
      salesContract: true,
    },
  });
  if (!reservation) throw new Error('Reservation not found');

  const folio = await prisma.folio.findUnique({ where: { id: folioId } });
  if (!folio || folio.reservationId !== reservationId) {
    throw new Error('Folio not found on reservation');
  }
  if (folio.type !== 'COMPANY' && folio.type !== 'AGENCY') {
    throw new Error('Only COMPANY or AGENCY folios can transfer to City Ledger');
  }
  if (transferAmount <= 0.01) {
    throw new Error('Nothing to transfer to City Ledger');
  }

  const checkIn = reservation.checkInDate;
  let hasContract = false;
  if (reservation.salesContractId) {
    const c = await findActiveSalesContract(reservation.salesContractId, checkIn);
    hasContract = Boolean(c);
  }
  if (!hasContract && reservation.agencyId) {
    const list = await prisma.salesContract.findMany({
      where: {
        agencyId: reservation.agencyId,
        status: 'ACTIVE',
        validFrom: { lte: checkIn },
        OR: [{ validTo: null }, { validTo: { gte: checkIn } }],
      },
      take: 1,
    });
    hasContract = list.length > 0;
  }
  if (!hasContract && reservation.companyId) {
    const list = await prisma.salesContract.findMany({
      where: {
        companyId: reservation.companyId,
        status: 'ACTIVE',
        validFrom: { lte: checkIn },
        OR: [{ validTo: null }, { validTo: { gte: checkIn } }],
      },
      take: 1,
    });
    hasContract = list.length > 0;
  }
  if (!hasContract) {
    throw new Error(
      'City Ledger transfer requires an ACTIVE sales contract for this stay, agency, or company',
    );
  }

  const party: 'AGENCY' | 'COMPANY' = folio.type === 'COMPANY' ? 'COMPANY' : 'AGENCY';
  await assertCityLedgerParty(reservation, party, transferAmount);
}

type MoneyLimit = { toNumber(): number } | null;

type LedgerPartyReservation = {
  id: string;
  creditLimitAzn: MoneyLimit;
  agencyId: string | null;
  companyId: string | null;
  agency: { voen: string | null; financeCounterpartyId: string | null; creditLimitAzn: MoneyLimit } | null;
  company: { voen: string | null; financeCounterpartyId: string | null; creditLimitAzn: MoneyLimit } | null;
};

/** Same gate for checkout transfer, CL_* tender, and COMPANY_ACCOUNT. Nothing is posted until this returns. */
export async function assertCanPostCityLedgerTender(
  reservationId: string,
  method: 'CL_AGENCY' | 'CL_COMPANY' | 'COMPANY_ACCOUNT',
  amount: number,
): Promise<void> {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { agency: true, company: true, salesContract: true },
  });
  if (!reservation) throw new Error('Reservation not found');
  const party: 'AGENCY' | 'COMPANY' =
    method === 'CL_AGENCY'
      ? 'AGENCY'
      : method === 'CL_COMPANY'
        ? 'COMPANY'
        : reservation.companyId
          ? 'COMPANY'
          : 'AGENCY';
  if (party === 'AGENCY' && !reservation.agencyId) throw new Error('Agency is not set on this stay');
  if (party === 'COMPANY' && !reservation.companyId) throw new Error('Company is not set on this stay');
  await assertStayHasCityLedgerContract(reservation);
  await assertCityLedgerParty(reservation, party, amount);
}

async function assertStayHasCityLedgerContract(reservation: {
  id: string;
  checkInDate: Date;
  salesContractId: string | null;
  agencyId: string | null;
  companyId: string | null;
}): Promise<void> {
  const checkIn = reservation.checkInDate;
  let hasContract = false;
  if (reservation.salesContractId) {
    hasContract = Boolean(await findActiveSalesContract(reservation.salesContractId, checkIn));
  }
  if (!hasContract && reservation.agencyId) {
    const list = await prisma.salesContract.findMany({
      where: {
        agencyId: reservation.agencyId,
        status: 'ACTIVE',
        validFrom: { lte: checkIn },
        OR: [{ validTo: null }, { validTo: { gte: checkIn } }],
      },
      take: 1,
    });
    hasContract = list.length > 0;
  }
  if (!hasContract && reservation.companyId) {
    const list = await prisma.salesContract.findMany({
      where: {
        companyId: reservation.companyId,
        status: 'ACTIVE',
        validFrom: { lte: checkIn },
        OR: [{ validTo: null }, { validTo: { gte: checkIn } }],
      },
      take: 1,
    });
    hasContract = list.length > 0;
  }
  if (!hasContract) {
    throw new Error(
      'City Ledger transfer requires an ACTIVE sales contract for this stay, agency, or company',
    );
  }
}

async function partyCreditLimit(
  reservation: LedgerPartyReservation,
  party: 'AGENCY' | 'COMPANY',
): Promise<number | null> {
  return resolveEffectiveCreditLimit(reservation.id, party);
}

async function assertCityLedgerParty(
  reservation: LedgerPartyReservation & {
    checkInDate: Date;
    salesContractId: string | null;
  },
  party: 'AGENCY' | 'COMPANY',
  transferAmount: number,
): Promise<void> {
  const limit = await partyCreditLimit(reservation, party);
  if (limit == null) {
    throw new Error(
      party === 'COMPANY'
        ? 'City Ledger transfer requires a credit limit on the stay, the company, or the hotel profile'
        : 'City Ledger transfer requires a credit limit on stay, agency, or hotel profile',
    );
  }

  const card = party === 'COMPANY' ? reservation.company : reservation.agency;
  const partyId = party === 'COMPANY' ? reservation.companyId : reservation.agencyId;
  if (!card || !partyId) {
    throw new Error(party === 'COMPANY' ? 'Company is not set on this stay' : 'Agency is not set on this stay');
  }
  const voen = card.voen?.trim();
  if (!voen) {
    throw new Error(
      party === 'COMPANY'
        ? 'City Ledger transfer requires company VÖEN'
        : 'City Ledger transfer requires agency VÖEN',
    );
  }

  const exposure = await counterpartyOpenArExposure(
    party === 'COMPANY' ? { companyId: partyId } : { agencyId: partyId },
  );
  if (exposure + transferAmount > limit + 0.01) {
    throw new Error(
      `Credit limit exceeded: exposure ${exposure.toFixed(2)} + transfer ${transferAmount.toFixed(2)} > limit ${limit.toFixed(2)} AZN`,
    );
  }
}

export async function getLastCityLedgerSnapshotAudit(entityId: string) {
  return prisma.satelliteAuditLog.findFirst({
    where: { entityType: 'CityLedgerSnapshot', entityId },
    orderBy: { createdAt: 'desc' },
  });
}

type CityLedgerPaymentCallbackInput = {
  folioId: string;
  invoiceId: string;
  paymentId: string;
  amount: number;
  fullyPaid: boolean;
};

export async function applyCityLedgerPaymentFromFinance(body: CityLedgerPaymentCallbackInput) {
  const { postPayment, folioBalance } = await import('@/lib/services/folio.service');

  const existing = await prisma.folioPayment.findFirst({
    where: {
      folioId: body.folioId,
      registerRef: body.paymentId,
      kind: 'PAYMENT',
    },
    select: { id: true },
  });
  if (existing) {
    const refreshed = await prisma.folio.findUnique({
      where: { id: body.folioId },
      include: { charges: true, payments: true },
    });
    if (!refreshed) throw new Error('Folio disappeared during idempotency check');

    const bal = folioBalance(refreshed.charges, refreshed.payments);
    const nextStatus =
      Math.abs(bal) <= 0.01 || body.fullyPaid ? 'CLOSED' : 'TRANSFERRED_AR';

    await prisma.folio.update({
      where: { id: refreshed.id },
      data: { status: nextStatus },
    });
    if (nextStatus === 'CLOSED') {
      const { maybeMarkReservationSettled } = await import(
        '@/lib/services/unsettled-departures.service'
      );
      await maybeMarkReservationSettled(refreshed.reservationId);
    }

    return {
      id: existing.id,
      paymentId: body.paymentId,
      folioId: refreshed.id,
      balance: bal,
      status: nextStatus,
      alreadyApplied: true as const,
    };
  }

  const folio = await prisma.folio.findUnique({
    where: { id: body.folioId },
    include: { charges: true, payments: true },
  });
  if (!folio) return null;

  if (folio.status !== 'OPEN') {
    await prisma.folio.update({
      where: { id: folio.id },
      data: { status: 'OPEN' },
    });
  }

  const payment = await postPayment({
    folioId: folio.id,
    amount: body.amount,
    paymentMethod: 'COMPANY_ACCOUNT',
    registerRef: body.paymentId,
    bankReference: body.invoiceId,
    skipCityLedgerGate: true,
  });

  const refreshed = await prisma.folio.findUnique({
    where: { id: folio.id },
    include: { charges: true, payments: true },
  });
  if (!refreshed) throw new Error('Folio disappeared during payment apply');

  const bal = folioBalance(refreshed.charges, refreshed.payments);
  const nextStatus =
    Math.abs(bal) <= 0.01 || body.fullyPaid ? 'CLOSED' : 'TRANSFERRED_AR';

  await prisma.folio.update({
    where: { id: folio.id },
    data: { status: nextStatus },
  });
  if (nextStatus === 'CLOSED') {
    const { maybeMarkReservationSettled } = await import(
      '@/lib/services/unsettled-departures.service'
    );
    await maybeMarkReservationSettled(folio.reservationId);
  }

  return {
    id: payment.id,
    paymentId: body.paymentId,
    folioId: folio.id,
    balance: bal,
    status: nextStatus,
    alreadyApplied: false as const,
  };
}
