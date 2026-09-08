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

export function sumFolioTypeActivity(
  folios: FolioSlice[],
  folioType: 'AGENCY' | 'COMPANY',
  from: Date,
  to: Date,
): { opening: number; newCharges: number; payments: number; cashPaid: number } {
  let newCharges = 0;
  let payments = 0;
  let cashPaid = 0;
  let openingCharges = 0;
  let openingPayments = 0;

  for (const folio of folios) {
    if (folio.type !== folioType) continue;
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

function packLedger(
  party: { code: string; name: string; settlementMode?: string; commissionPercent?: unknown },
  slice: { opening: number; newCharges: number; payments: number; cashPaid: number },
) {
  const closing = slice.opening + slice.newCharges - slice.payments;
  return {
    code: party.code,
    name: party.name,
    settlementMode: party.settlementMode ?? 'POSTPAID',
    commissionPercent:
      party.commissionPercent != null ? Number(party.commissionPercent) : null,
    opening: slice.opening,
    newCharges: slice.newCharges,
    payments: slice.payments,
    cashPaid: slice.cashPaid,
    netAmount: slice.newCharges - slice.payments,
    cityLedger: closing,
    closing,
  };
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

  const slice = sumFolioTypeActivity(reservations.flatMap((r) => r.folios), 'AGENCY', from, to);
  return {
    kind: 'AGENCY' as const,
    agency,
    ...packLedger(agency, slice),
    reservationCount: reservations.length,
  };
}

export async function getCompanyLedger(companyId: string, from: Date, to: Date) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new Error('Company not found');

  const reservations = await prisma.reservation.findMany({
    where: {
      companyId,
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

  const slice = sumFolioTypeActivity(reservations.flatMap((r) => r.folios), 'COMPANY', from, to);
  return {
    kind: 'COMPANY' as const,
    company,
    ...packLedger(company, slice),
    reservationCount: reservations.length,
  };
}

export async function listAgencyClSummary(from: Date, to: Date) {
  const agencies = await prisma.agency.findMany({ orderBy: { code: 'asc' } });
  const rows = [];
  for (const agency of agencies) {
    const ledger = await getAgencyLedger(agency.id, from, to);
    rows.push({
      kind: 'AGENCY' as const,
      partyId: agency.id,
      code: agency.code,
      name: agency.name,
      settlementMode: agency.settlementMode,
      commissionPercent:
        agency.commissionPercent != null ? Number(agency.commissionPercent) : null,
      cityLedger: ledger.cityLedger,
      cashPaid: ledger.cashPaid,
      netAmount: ledger.netAmount,
    });
  }
  return rows;
}

export async function listCompanyClSummary(from: Date, to: Date) {
  const companies = await prisma.company.findMany({ orderBy: { code: 'asc' } });
  const rows = [];
  for (const company of companies) {
    const ledger = await getCompanyLedger(company.id, from, to);
    rows.push({
      kind: 'COMPANY' as const,
      partyId: company.id,
      code: company.code,
      name: company.name,
      settlementMode: company.settlementMode,
      commissionPercent: null as number | null,
      cityLedger: ledger.cityLedger,
      cashPaid: ledger.cashPaid,
      netAmount: ledger.netAmount,
    });
  }
  return rows;
}

export async function listCityLedgerSummary(from: Date, to: Date, kind: 'AGENCY' | 'COMPANY' | 'ALL') {
  const agencyRows = kind === 'COMPANY' ? [] : await listAgencyClSummary(from, to);
  const companyRows = kind === 'AGENCY' ? [] : await listCompanyClSummary(from, to);
  return [...agencyRows, ...companyRows];
}
