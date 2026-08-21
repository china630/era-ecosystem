import { prisma } from '@/lib/prisma';
import { decimalToNumber } from '@/lib/decimal';
import { folioBalance } from '@/lib/services/folio.service';
import { findActiveSalesContract } from '@/lib/services/sales-contract.service';
import { resolveCreditLimitAzn } from '@/lib/services/guest-dedup.service';
import { getHotelPolicy } from '@/lib/services/hotel-policy.service';
import { satelliteOrganizationId } from '@era/satellite-kit';

export type CityLedgerCounterparty = {
  agencyId?: string | null;
  companyGuestId?: string | null;
};

/**
 * Sum of open AR exposure for agency (PENDING_AR + TRANSFERRED_AR folio balances).
 */
export async function counterpartyOpenArExposure(input: {
  agencyId?: string | null;
}): Promise<number> {
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
  if (!hasContract) {
    throw new Error(
      'City Ledger transfer requires an ACTIVE sales contract for this stay or agency',
    );
  }

  const limit = await resolveEffectiveCreditLimit(reservationId);
  if (limit == null) {
    throw new Error('City Ledger transfer requires a credit limit on stay, agency, or hotel profile');
  }

  // Agency money is paid by bank to Finance; without a local Finance counterparty card
  // (resolved by agency VÖEN) we must fail-fast so checkout does not create "orphan" AR.
  if (reservation.agencyId) {
    const voen = reservation.agency?.voen?.trim();
    if (!voen) {
      throw new Error('City Ledger transfer requires agency VÖEN');
    }

    const policy = await getHotelPolicy();
    const { cityLedgerMissingCounterparty } = policy;

    const cached = reservation.agency!.financeCounterpartyId ?? null;
    if (!cached) {
      const orgId = satelliteOrganizationId();
      if (!orgId || orgId === 'demo-org') {
        throw new Error('ERA_SATELLITE_ORGANIZATION_ID is not configured for Finance lookup');
      }

      const financeBase = process.env.NEXT_PUBLIC_FINANCE_WEB_URL?.replace(/\/$/, '').trim();
      if (!financeBase) {
        throw new Error('NEXT_PUBLIC_FINANCE_WEB_URL is not configured (needed for Finance counterparty lookup)');
      }

      const token = process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim();
      if (!token) {
        throw new Error(
          'SATELLITE_EVENT_SERVICE_TOKEN is not configured (needed for Finance internal lookup)',
        );
      }

      const lookupUrl = `${financeBase}/api/internal/v1/counterparties/by-voen?taxId=${encodeURIComponent(
        voen,
      )}`;

      async function lookupFromFinance(): Promise<string | null> {
        const res = await fetch(lookupUrl, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'x-organization-id': orgId,
          },
        });
        if (res.status === 404) return null;
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`Finance counterparty lookup failed: HTTP ${res.status} ${text}`);
        }
        const body = (await res.json()) as { id?: string | null };
        return body.id ?? null;
      }

      async function autoCreateInFinance(): Promise<string | null> {
        const res = await fetch(`${financeBase}/api/internal/v1/counterparties/find-or-create-by-voen`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'x-organization-id': orgId,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ taxId: voen, nameFallback: voen }),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`Finance counterparty auto-create failed: HTTP ${res.status} ${text}`);
        }
        const body = (await res.json()) as { id?: string | null };
        return body.id ?? null;
      }

      let resolved: string | null = null;
      if (cityLedgerMissingCounterparty === 'AUTO_CREATE') {
        resolved = await autoCreateInFinance();
      } else {
        resolved = await lookupFromFinance();
      }

      if (!resolved) {
        if (cityLedgerMissingCounterparty === 'BLOCK_CHECKOUT') {
          throw new Error(
            `City Ledger transfer blocked: no Finance counterparty for VOEN=${voen} (set cityLedgerMissingCounterparty policy to DEFER_HANDOFF/AUTO_CREATE)`,
          );
        }
        // DEFER_HANDOFF: allow checkout; Finance invoice will be created later when counterparty appears.
      } else {
        await prisma.agency.update({
          where: { id: reservation.agencyId },
          data: { financeCounterpartyId: resolved },
        });
      }
    }
  }

  const exposure = await counterpartyOpenArExposure({ agencyId: reservation.agencyId });
  if (exposure + transferAmount > limit + 0.01) {
    throw new Error(
      `Credit limit exceeded: exposure ${exposure.toFixed(2)} + transfer ${transferAmount.toFixed(2)} > limit ${limit.toFixed(2)} AZN`,
    );
  }
}
