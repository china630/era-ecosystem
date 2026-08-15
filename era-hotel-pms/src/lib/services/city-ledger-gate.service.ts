import { prisma } from '@/lib/prisma';
import { decimalToNumber } from '@/lib/decimal';
import { folioBalance } from '@/lib/services/folio.service';
import { findActiveSalesContract } from '@/lib/services/sales-contract.service';
import { resolveCreditLimitAzn } from '@/lib/services/guest-dedup.service';

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

  const exposure = await counterpartyOpenArExposure({ agencyId: reservation.agencyId });
  if (exposure + transferAmount > limit + 0.01) {
    throw new Error(
      `Credit limit exceeded: exposure ${exposure.toFixed(2)} + transfer ${transferAmount.toFixed(2)} > limit ${limit.toFixed(2)} AZN`,
    );
  }
}
