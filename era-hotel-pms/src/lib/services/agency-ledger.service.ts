import { prisma } from '@/lib/prisma';
import { decimalToNumber } from '@/lib/decimal';
import type { Decimal } from '@prisma/client/runtime/library';

export async function listAgencies() {
  return prisma.agency.findMany({ orderBy: { code: 'asc' } });
}

type FolioSlice = {
  type: string;
  charges: Array<{ amount: Decimal; qty: number; businessDate: Date }>;
  payments: Array<{ amount: Decimal; paymentMethod: string; createdAt: Date }>;
};

function sumAgencyFolioActivity(
  folios: FolioSlice[],
  from: Date,
  to: Date,
): { opening: number; newCharges: number; payments: number; cashPaid: number } {
  let newCharges = 0;
  let payments = 0;
  let cashPaid = 0;
  let openingCharges = 0;
  let openingPayments = 0;

  for (const folio of folios) {
    if (folio.type !== 'COMPANY' && folio.type !== 'AGENCY') continue;
    for (const c of folio.charges) {
      const amt = decimalToNumber(c.amount) * c.qty;
      if (c.businessDate < from) openingCharges += amt;
      else if (c.businessDate >= from && c.businessDate <= to) newCharges += amt;
    }
    for (const p of folio.payments) {
      const amt = decimalToNumber(p.amount);
      if (p.createdAt < from) openingPayments += amt;
      else if (p.createdAt >= from && p.createdAt <= to) {
        payments += amt;
        if (p.paymentMethod === 'CASH') cashPaid += amt;
      }
    }
  }

  return { opening: openingCharges - openingPayments, newCharges, payments, cashPaid };
}

export async function getAgencyLedger(agencyId: string, from: Date, to: Date) {
  const agency = await prisma.agency.findUnique({ where: { id: agencyId } });
  if (!agency) throw new Error('Agency not found');

  const reservations = await prisma.reservation.findMany({
    where: {
      agencyId,
      OR: [{ checkInDate: { lte: to }, checkOutDate: { gte: from } }],
    },
    include: {
      folios: {
        include: {
          charges: { include: { revenueCode: true } },
          payments: true,
        },
      },
    },
  });

  const { opening, newCharges, payments, cashPaid } = sumAgencyFolioActivity(
    reservations.flatMap((r) => r.folios),
    from,
    to,
  );
  const closing = opening + newCharges - payments;
  const netAmount = newCharges - payments;

  return {
    agency,
    opening,
    newCharges,
    payments,
    cashPaid,
    netAmount,
    cityLedger: closing,
    closing,
    reservationCount: reservations.length,
  };
}

export async function listAgencyClSummary(from: Date, to: Date) {
  const agencies = await prisma.agency.findMany({ orderBy: { code: 'asc' } });
  const rows = [];
  for (const agency of agencies) {
    const ledger = await getAgencyLedger(agency.id, from, to);
    rows.push({
      agencyId: agency.id,
      agencyCode: agency.code,
      agencyName: agency.name,
      cityLedger: ledger.cityLedger,
      cashPaid: ledger.cashPaid,
      netAmount: ledger.netAmount,
      newCharges: ledger.newCharges,
      payments: ledger.payments,
    });
  }
  return rows;
}
