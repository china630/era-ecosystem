import { prisma } from '@/lib/prisma';
import { decimalToNumber, toDecimal } from '@/lib/decimal';
import type { SalesContractStatus, SalesContractCounterpartyType } from '@prisma/client';

const contractInclude = {
  agency: true,
  companyGuest: true,
  ratePlan: true,
  allotments: { include: { roomType: true } },
  _count: { select: { reservations: true } },
} as const;

export async function listSalesContracts(filters?: { status?: SalesContractStatus; agencyId?: string }) {
  return prisma.salesContract.findMany({
    where: {
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.agencyId ? { agencyId: filters.agencyId } : {}),
    },
    include: contractInclude,
    orderBy: [{ validFrom: 'desc' }, { code: 'asc' }],
  });
}

export async function getSalesContract(id: string) {
  const row = await prisma.salesContract.findUnique({
    where: { id },
    include: contractInclude,
  });
  if (!row) throw new Error('Sales contract not found');
  return row;
}

export async function createSalesContract(input: {
  code: string;
  name: string;
  counterpartyType?: SalesContractCounterpartyType;
  agencyId?: string;
  companyGuestId?: string;
  validFrom: Date;
  validTo?: Date;
  status?: SalesContractStatus;
  ratePlanId: string;
  minStay?: number;
  cta?: boolean;
  ctd?: boolean;
  commissionPercent?: number;
  depositRequired?: boolean;
  depositAmount?: number;
  notes?: string;
  externalRef?: string;
}) {
  if (input.counterpartyType === 'AGENCY' && !input.agencyId) {
    throw new Error('Agency is required for AGENCY counterparty type');
  }
  if (input.counterpartyType === 'CORPORATE' && !input.companyGuestId) {
    throw new Error('Company guest is required for CORPORATE counterparty type');
  }

  const ratePlan = await prisma.ratePlan.findUnique({ where: { id: input.ratePlanId } });
  if (!ratePlan || !ratePlan.active) throw new Error('Rate plan not found or inactive');

  return prisma.salesContract.create({
    data: {
      code: input.code.trim().toUpperCase(),
      name: input.name,
      counterpartyType: input.counterpartyType ?? 'AGENCY',
      agencyId: input.agencyId,
      companyGuestId: input.companyGuestId,
      validFrom: input.validFrom,
      validTo: input.validTo,
      status: input.status ?? 'DRAFT',
      ratePlanId: input.ratePlanId,
      minStay: input.minStay,
      cta: input.cta ?? false,
      ctd: input.ctd ?? false,
      commissionPercent:
        input.commissionPercent != null ? toDecimal(input.commissionPercent) : undefined,
      depositRequired: input.depositRequired ?? false,
      depositAmount: input.depositAmount != null ? toDecimal(input.depositAmount) : undefined,
      notes: input.notes,
      externalRef: input.externalRef,
    },
    include: contractInclude,
  });
}

export async function updateSalesContract(
  id: string,
  input: Partial<{
    name: string;
    counterpartyType: SalesContractCounterpartyType;
    agencyId: string | null;
    companyGuestId: string | null;
    validFrom: Date;
    validTo: Date | null;
    status: SalesContractStatus;
    ratePlanId: string;
    minStay: number | null;
    cta: boolean;
    ctd: boolean;
    commissionPercent: number | null;
    depositRequired: boolean;
    depositAmount: number | null;
    notes: string | null;
    externalRef: string | null;
  }>,
) {
  return prisma.salesContract.update({
    where: { id },
    data: {
      ...input,
      commissionPercent:
        input.commissionPercent != null ? toDecimal(input.commissionPercent) : input.commissionPercent,
      depositAmount:
        input.depositAmount != null ? toDecimal(input.depositAmount) : input.depositAmount,
    },
    include: contractInclude,
  });
}

export async function findActiveSalesContract(
  salesContractId: string,
  checkInDate: Date,
): Promise<{ id: string; ratePlanId: string; agencyId: string | null; commissionPercent: number | null } | null> {
  const day = new Date(checkInDate.toISOString().slice(0, 10));
  const contract = await prisma.salesContract.findFirst({
    where: {
      id: salesContractId,
      status: 'ACTIVE',
      validFrom: { lte: day },
      OR: [{ validTo: null }, { validTo: { gte: day } }],
    },
    select: {
      id: true,
      ratePlanId: true,
      agencyId: true,
      commissionPercent: true,
      minStay: true,
      cta: true,
      ctd: true,
    },
  });
  if (!contract) return null;
  return {
    ...contract,
    commissionPercent: contract.commissionPercent
      ? decimalToNumber(contract.commissionPercent)
      : null,
  };
}

export async function listActiveContractsForAgency(agencyId: string, checkInDate: Date) {
  const day = new Date(checkInDate.toISOString().slice(0, 10));
  return prisma.salesContract.findMany({
    where: {
      agencyId,
      status: 'ACTIVE',
      validFrom: { lte: day },
      OR: [{ validTo: null }, { validTo: { gte: day } }],
    },
    include: { ratePlan: true, allotments: { include: { roomType: true } } },
    orderBy: { code: 'asc' },
  });
}

export async function getContractUtilization(contractId: string) {
  const contract = await getSalesContract(contractId);
  const reservations = await prisma.reservation.findMany({
    where: {
      salesContractId: contractId,
      status: { in: ['CONFIRMED', 'IN_HOUSE', 'OPTION'] },
    },
    select: { roomTypeId: true, checkInDate: true, checkOutDate: true },
  });

  const allotmentNights = contract.allotments.reduce((sum, a) => {
    const nights = Math.max(
      1,
      Math.ceil((a.validTo.getTime() - a.validFrom.getTime()) / 86400000) + 1,
    );
    return sum + a.nightlyQuota * nights;
  }, 0);

  let consumedNights = 0;
  for (const r of reservations) {
    const nights = Math.max(
      1,
      Math.ceil((r.checkOutDate.getTime() - r.checkInDate.getTime()) / 86400000),
    );
    consumedNights += nights;
  }

  const totalRevenue = await prisma.reservation.aggregate({
    where: { salesContractId: contractId, status: { not: 'CANCELLED' } },
    _sum: { totalAmount: true },
  });

  return {
    contractId,
    code: contract.code,
    reservationCount: reservations.length,
    allotmentNights,
    consumedNights,
    utilizationPercent:
      allotmentNights > 0 ? Math.round((consumedNights / allotmentNights) * 10000) / 100 : null,
    totalRevenue: decimalToNumber(totalRevenue._sum.totalAmount ?? 0),
  };
}
