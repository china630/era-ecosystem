import { prisma } from '@/lib/prisma';
import { requestOrganizationId } from '@/lib/request-organization';
import { decimalToNumber } from '@/lib/decimal';
import { folioBalance } from '@/lib/services/folio.service';
import { findActiveSalesContract } from '@/lib/services/sales-contract.service';
import { resolveCreditLimitAzn } from '@/lib/services/guest-dedup.service';
import { getHotelPolicy } from '@/lib/services/hotel-policy.service';

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
  const folios = await prisma.folio.findMany({
    where: {
      status: { in: ['PENDING_AR', 'TRANSFERRED_AR'] },
      type: { in: ['AGENCY', 'COMPANY'] },
      reservation: { agencyId: input.agencyId },
    },
    include: { charges: true, payments: true },
  });
  return folios.reduce((s, f) => s + folioBalance(f.charges, f.payments), 0);
}

export async function resolveEffectiveCreditLimit(reservationId: string): Promise<number | null> {
  const stayLimit = await resolveCreditLimitAzn(reservationId);
  if (stayLimit != null) return stayLimit;

  const res = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: { agencyId: true, agency: { select: { creditLimitAzn: true } } },
  });
  if (res?.agency?.creditLimitAzn != null) {
    return decimalToNumber(res.agency.creditLimitAzn);
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

/** Same gate for checkout transfer and a CL_* tender. Nothing is posted until this returns. */
export async function assertCanPostCityLedgerTender(
  reservationId: string,
  method: 'CL_AGENCY' | 'CL_COMPANY',
  amount: number,
): Promise<void> {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { agency: true, company: true, salesContract: true },
  });
  if (!reservation) throw new Error('Reservation not found');
  const party: 'AGENCY' | 'COMPANY' = method === 'CL_COMPANY' ? 'COMPANY' : 'AGENCY';
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
  if (reservation.creditLimitAzn != null) return decimalToNumber(reservation.creditLimitAzn);
  const card = party === 'COMPANY' ? reservation.company?.creditLimitAzn : reservation.agency?.creditLimitAzn;
  if (card != null) return decimalToNumber(card);
  const profile = await prisma.hotelProfile.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { defaultCreditLimitAzn: true },
  });
  if (profile?.defaultCreditLimitAzn != null) return decimalToNumber(profile.defaultCreditLimitAzn);
  return null;
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
  await ensureFinanceCounterparty({
    voen,
    cachedId: card.financeCounterpartyId,
    save: async (id) => {
      if (party === 'COMPANY') {
        await prisma.company.update({ where: { id: partyId }, data: { financeCounterpartyId: id } });
      } else {
        await prisma.agency.update({ where: { id: partyId }, data: { financeCounterpartyId: id } });
      }
    },
  });

  const exposure = await counterpartyOpenArExposure(
    party === 'COMPANY' ? { companyId: partyId } : { agencyId: partyId },
  );
  if (exposure + transferAmount > limit + 0.01) {
    throw new Error(
      `Credit limit exceeded: exposure ${exposure.toFixed(2)} + transfer ${transferAmount.toFixed(2)} > limit ${limit.toFixed(2)} AZN`,
    );
  }
}

async function ensureFinanceCounterparty(input: {
  voen: string;
  cachedId: string | null;
  save: (id: string) => Promise<void>;
}): Promise<void> {
  if (input.cachedId) return;
  const policy = await getHotelPolicy();
  const { cityLedgerMissingCounterparty } = policy;
  const orgId = requestOrganizationId();
  if (!orgId || orgId === 'demo-org') {
    throw new Error('ERA_SATELLITE_ORGANIZATION_ID is not configured for Finance lookup');
  }
  const financeBase = process.env.NEXT_PUBLIC_FINANCE_WEB_URL?.replace(/\/$/, '').trim();
  if (!financeBase) {
    throw new Error('NEXT_PUBLIC_FINANCE_WEB_URL is not configured (needed for Finance counterparty lookup)');
  }
  const token = process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim();
  if (!token) {
    throw new Error('SATELLITE_EVENT_SERVICE_TOKEN is not configured (needed for Finance internal lookup)');
  }
  const headers = { Authorization: `Bearer ${token}`, 'x-organization-id': orgId };
  let resolved: string | null = null;
  if (cityLedgerMissingCounterparty === 'AUTO_CREATE') {
    const res = await fetch(`${financeBase}/api/internal/v1/counterparties/find-or-create-by-voen`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ taxId: input.voen, nameFallback: input.voen }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Finance counterparty auto-create failed: HTTP ${res.status} ${text}`);
    }
    resolved = ((await res.json()) as { id?: string | null }).id ?? null;
  } else {
    const res = await fetch(
      `${financeBase}/api/internal/v1/counterparties/by-voen?taxId=${encodeURIComponent(input.voen)}`,
      { method: 'GET', headers },
    );
    if (res.status !== 404) {
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Finance counterparty lookup failed: HTTP ${res.status} ${text}`);
      }
      resolved = ((await res.json()) as { id?: string | null }).id ?? null;
    }
  }
  if (!resolved) {
    if (cityLedgerMissingCounterparty === 'BLOCK_CHECKOUT') {
      throw new Error(
        `City Ledger transfer blocked: no Finance counterparty for VOEN=${input.voen} (set cityLedgerMissingCounterparty policy to DEFER_HANDOFF/AUTO_CREATE)`,
      );
    }
    return;
  }
  await input.save(resolved);
}
