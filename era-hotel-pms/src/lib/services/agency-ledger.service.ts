import { prisma } from '@/lib/prisma';
import { decimalToNumber } from '@/lib/decimal';
import type { Decimal } from '@prisma/client/runtime/library';

export async function listAgencies() {
  return prisma.agency.findMany({ orderBy: { code: 'asc' } });
}

type FolioSlice = {
  type: string;
  charges: Array<{ amount: Decimal; qty: number; businessDate: Date }>;
  payments: Array<{
    amount: Decimal;
    paymentMethod: string;
    createdAt: Date;
    kind?: string | null;
  }>;
};

/** Net payment amount: PAYMENT increases settlement; REFUND reverses it. */
export function paymentSignedAmount(amount: number, kind?: string | null): number {
  return kind === 'REFUND' ? -amount : amount;
}

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
      const amt = paymentSignedAmount(decimalToNumber(p.amount), p.kind);
      if (p.createdAt < from) openingPayments += amt;
      else if (p.createdAt >= from && p.createdAt <= to) {
        payments += amt;
        if (p.kind !== 'REFUND' && p.paymentMethod === 'CASH') {
          cashPaid += decimalToNumber(p.amount);
        }
      }
    }
  }

  return { opening: openingCharges - openingPayments, newCharges, payments, cashPaid };
}

export type CityLedgerStatementLine = {
  id: string;
  kind: 'CHARGE' | 'PAYMENT' | 'REFUND';
  at: string;
  businessDate: string | null;
  reservationId: string;
  reservationRef: string | null;
  guestName: string | null;
  roomLabel: string | null;
  folioId: string;
  folioStatus: string;
  description: string;
  code: string | null;
  qty: number | null;
  /** Signed toward party debt: charge/refund +, payment − */
  amount: number;
  runningBalance: number;
};

type FolioForStatement = {
  id: string;
  type: string;
  status: string;
  reservationId: string;
  charges: Array<{
    id: string;
    amount: Decimal;
    qty: number;
    description: string;
    businessDate: Date;
    revenueCode: { code: string; name: string } | null;
  }>;
  payments: Array<{
    id: string;
    amount: Decimal;
    paymentMethod: string;
    kind: string;
    createdAt: Date;
  }>;
  reservation: {
    id: string;
    externalRef: string | null;
    checkInDate: Date;
    checkOutDate: Date;
    guest: { fullName: string } | null;
    room: { roomNumber: string } | null;
    roomType: { code: string } | null;
  };
};

function buildStatementLines(
  folios: FolioForStatement[],
  folioType: 'AGENCY' | 'COMPANY',
  from: Date,
  to: Date,
  opening: number,
): CityLedgerStatementLine[] {
  type Raw = Omit<CityLedgerStatementLine, 'runningBalance'> & { sortAt: number };
  const raw: Raw[] = [];

  for (const folio of folios) {
    if (folio.type !== folioType) continue;
    const guestName = folio.reservation.guest?.fullName ?? null;
    const roomLabel =
      folio.reservation.room?.roomNumber != null
        ? folio.reservation.room.roomNumber
        : (folio.reservation.roomType?.code ?? null);
    const reservationRef = folio.reservation.externalRef;

    for (const c of folio.charges) {
      if (c.businessDate < from || c.businessDate > to) continue;
      const amt = decimalToNumber(c.amount) * c.qty;
      const atIso = c.businessDate.toISOString();
      raw.push({
        id: `chg:${c.id}`,
        kind: 'CHARGE',
        at: atIso,
        businessDate: atIso.slice(0, 10),
        reservationId: folio.reservationId,
        reservationRef,
        guestName,
        roomLabel,
        folioId: folio.id,
        folioStatus: folio.status,
        description: c.description || c.revenueCode?.name || 'Charge',
        code: c.revenueCode?.code ?? null,
        qty: c.qty,
        amount: amt,
        sortAt: c.businessDate.getTime(),
      });
    }

    for (const p of folio.payments) {
      if (p.createdAt < from || p.createdAt > to) continue;
      const abs = decimalToNumber(p.amount);
      const isRefund = p.kind === 'REFUND';
      const atIso = p.createdAt.toISOString();
      raw.push({
        id: `pay:${p.id}`,
        kind: isRefund ? 'REFUND' : 'PAYMENT',
        at: atIso,
        businessDate: atIso.slice(0, 10),
        reservationId: folio.reservationId,
        reservationRef,
        guestName,
        roomLabel,
        folioId: folio.id,
        folioStatus: folio.status,
        description: isRefund ? `Refund (${p.paymentMethod})` : `Payment (${p.paymentMethod})`,
        code: p.paymentMethod,
        qty: null,
        // Debt direction: charge +, payment −, refund +
        amount: isRefund ? abs : -abs,
        sortAt: p.createdAt.getTime(),
      });
    }
  }

  raw.sort((a, b) => a.sortAt - b.sortAt || a.id.localeCompare(b.id));

  let running = opening;
  return raw.map(({ sortAt: _s, ...line }) => {
    running += line.amount;
    return { ...line, runningBalance: Math.round(running * 100) / 100 };
  });
}

function packLedger(
  party: { code: string; name: string; settlementMode?: string; commissionPercent?: unknown },
  slice: { opening: number; newCharges: number; payments: number; cashPaid: number },
  lines: CityLedgerStatementLine[],
) {
  const closing = slice.opening + slice.newCharges - slice.payments;
  const lastRunning = lines.length > 0 ? lines[lines.length - 1]!.runningBalance : slice.opening;
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
    /** Statement running balance must match closing (within rounding). */
    statementBalance: lastRunning,
    lines,
  };
}

const folioInclude = {
  charges: { include: { revenueCode: true } },
  payments: true,
  reservation: {
    select: {
      id: true,
      externalRef: true,
      checkInDate: true,
      checkOutDate: true,
      guest: { select: { fullName: true } },
      room: { select: { roomNumber: true } },
      roomType: { select: { code: true } },
    },
  },
} as const;

/**
 * Load party CL folios with full history (not stay-overlap only).
 * Stay-overlap filter would drop open AR from earlier stays and understate opening.
 */
async function loadPartyFolios(
  folioType: 'AGENCY' | 'COMPANY',
  partyField: 'agencyId' | 'companyId',
  partyId: string,
) {
  return prisma.folio.findMany({
    where: {
      type: folioType,
      reservation: { [partyField]: partyId },
    },
    include: folioInclude,
    orderBy: { createdAt: 'asc' },
  });
}

export async function getAgencyLedger(agencyId: string, from: Date, to: Date) {
  const agency = await prisma.agency.findUnique({ where: { id: agencyId } });
  if (!agency) throw new Error('Agency not found');

  const folios = await loadPartyFolios('AGENCY', 'agencyId', agencyId);
  const slice = sumFolioTypeActivity(folios, 'AGENCY', from, to);
  const lines = buildStatementLines(folios, 'AGENCY', from, to, slice.opening);
  const reservationIds = new Set(folios.map((f) => f.reservationId));

  return {
    kind: 'AGENCY' as const,
    agency,
    ...packLedger(agency, slice, lines),
    reservationCount: reservationIds.size,
    folioCount: folios.length,
  };
}

export async function getCompanyLedger(companyId: string, from: Date, to: Date) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new Error('Company not found');

  const folios = await loadPartyFolios('COMPANY', 'companyId', companyId);
  const slice = sumFolioTypeActivity(folios, 'COMPANY', from, to);
  const lines = buildStatementLines(folios, 'COMPANY', from, to, slice.opening);
  const reservationIds = new Set(folios.map((f) => f.reservationId));

  return {
    kind: 'COMPANY' as const,
    company,
    ...packLedger(company, slice, lines),
    reservationCount: reservationIds.size,
    folioCount: folios.length,
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
