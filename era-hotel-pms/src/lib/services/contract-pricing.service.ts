import { prisma } from '@/lib/prisma';
import { decimalToNumber, toDecimal } from '@/lib/decimal';
import type { ContractPricingRule, ContractPricingRuleType } from '@prisma/client';

export async function listContractPricingRules() {
  return prisma.contractPricingRule.findMany({
    include: { agency: true, ratePlan: true },
    orderBy: [{ validFrom: 'desc' }, { name: 'asc' }],
  });
}

export async function createContractPricingRule(input: {
  name: string;
  agencyId?: string;
  ratePlanId: string;
  ruleType: ContractPricingRuleType;
  valuePercent: number;
  validFrom: Date;
  validTo?: Date;
  active?: boolean;
}) {
  return prisma.contractPricingRule.create({
    data: {
      name: input.name,
      agencyId: input.agencyId,
      ratePlanId: input.ratePlanId,
      ruleType: input.ruleType,
      valuePercent: toDecimal(input.valuePercent),
      validFrom: input.validFrom,
      validTo: input.validTo,
      active: input.active ?? true,
    },
    include: { agency: true, ratePlan: true },
  });
}

export async function updateContractPricingRule(
  id: string,
  input: Partial<{
    name: string;
    agencyId: string | null;
    ratePlanId: string;
    ruleType: ContractPricingRuleType;
    valuePercent: number;
    validFrom: Date;
    validTo: Date | null;
    active: boolean;
  }>,
) {
  return prisma.contractPricingRule.update({
    where: { id },
    data: {
      ...input,
      valuePercent: input.valuePercent != null ? toDecimal(input.valuePercent) : undefined,
    },
    include: { agency: true, ratePlan: true },
  });
}

export async function deleteContractPricingRule(id: string) {
  return prisma.contractPricingRule.delete({ where: { id } });
}

export async function findApplicableContractRule(
  ratePlanId: string,
  checkInDate: Date,
  agencyId?: string | null,
): Promise<ContractPricingRule | null> {
  const day = new Date(checkInDate.toISOString().slice(0, 10));
  const baseWhere = {
    ratePlanId,
    active: true,
    validFrom: { lte: day },
    OR: [{ validTo: null }, { validTo: { gte: day } }],
  };

  if (agencyId) {
    const agencyRule = await prisma.contractPricingRule.findFirst({
      where: { ...baseWhere, agencyId },
      orderBy: { validFrom: 'desc' },
    });
    if (agencyRule) return agencyRule;
  }

  return prisma.contractPricingRule.findFirst({
    where: { ...baseWhere, agencyId: null },
    orderBy: { validFrom: 'desc' },
  });
}

export function applyContractRuleToNightly(
  baseNightly: number,
  rule: ContractPricingRule | null,
): { nightly: number; ruleId?: string; ruleName?: string } {
  if (!rule) return { nightly: baseNightly };
  const pct = decimalToNumber(rule.valuePercent);
  const factor = rule.ruleType === 'DISCOUNT' ? 1 - pct / 100 : 1 + pct / 100;
  const nightly = Math.max(0, Math.round(baseNightly * factor * 100) / 100);
  return { nightly, ruleId: rule.id, ruleName: rule.name };
}

export async function quoteBookingRate(input: {
  ratePlanId: string;
  checkInDate: Date;
  checkOutDate: Date;
  agencyId?: string;
}) {
  const ratePlan = await prisma.ratePlan.findUnique({ where: { id: input.ratePlanId } });
  if (!ratePlan) throw new Error('Rate plan not found');

  const rule = await findApplicableContractRule(
    input.ratePlanId,
    input.checkInDate,
    input.agencyId,
  );
  const baseNightly = decimalToNumber(ratePlan.pricePerNight);
  const { nightly, ruleId, ruleName } = applyContractRuleToNightly(baseNightly, rule);
  const nights = Math.max(
    1,
    Math.ceil(
      (input.checkOutDate.getTime() - input.checkInDate.getTime()) / 86400000,
    ),
  );

  return {
    ratePlanCode: ratePlan.code,
    baseNightly,
    adjustedNightly: nightly,
    nights,
    totalAmount: nightly * nights,
    contractRuleId: ruleId ?? null,
    contractRuleName: ruleName ?? null,
    ruleType: rule?.ruleType ?? null,
    valuePercent: rule ? decimalToNumber(rule.valuePercent) : null,
  };
}
