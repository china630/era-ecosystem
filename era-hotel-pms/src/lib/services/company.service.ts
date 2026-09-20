import { prisma } from '@/lib/prisma';
import { requestOrganizationId } from '@/lib/request-organization';
import { toDecimal } from '@/lib/decimal';
import type { B2bSettlementMode } from '@prisma/client';

export async function listCompanies(activeOnly = false) {
  return prisma.company.findMany({
    where: activeOnly ? { active: true } : undefined,
    orderBy: { code: 'asc' },
  });
}

export async function upsertCompany(input: {
  id?: string;
  code: string;
  name: string;
  voen?: string;
  settlementMode?: B2bSettlementMode;
  creditLimitAzn?: number | null;
  paymentTermsDays?: number | null;
  active?: boolean;
}) {
  const org = requestOrganizationId();
  const data = {
    code: input.code,
    name: input.name,
    voen: input.voen,
    settlementMode: input.settlementMode ?? 'POSTPAID',
    creditLimitAzn:
      input.creditLimitAzn != null ? toDecimal(input.creditLimitAzn) : input.creditLimitAzn,
    paymentTermsDays: input.paymentTermsDays,
    active: input.active ?? true,
  };
  if (input.id) {
    return prisma.company.update({ where: { id: input.id }, data });
  }
  return prisma.company.create({
    data: { ...data, organizationId: org },
  });
}
