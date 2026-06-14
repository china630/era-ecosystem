import type { ProcedureCompatibilityRuleType } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type ScheduledProcedure = {
  procedureCode: string;
  startAt: Date;
  endAt: Date;
};

export type CompatibilityViolation = {
  ruleType: ProcedureCompatibilityRuleType;
  procedureCodeA: string;
  procedureCodeB: string;
  message: string;
};

function sameDay(a: Date, b: Date): boolean {
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}

function hoursBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / 3_600_000;
}

/** Check a candidate slot against existing scheduled procedures. */
export async function validateProcedureCompatibility(input: {
  candidateCode: string;
  startAt: Date;
  endAt: Date;
  existing: ScheduledProcedure[];
  excludeCodes?: string[];
}): Promise<CompatibilityViolation[]> {
  const rules = await prisma.procedureCompatibilityRule.findMany({
    where: { active: true },
  });

  const violations: CompatibilityViolation[] = [];
  const existing = input.existing.filter(
    (e) => !input.excludeCodes?.includes(e.procedureCode),
  );

  for (const rule of rules) {
    const touchesA =
      rule.procedureCodeA === input.candidateCode ||
      rule.procedureCodeB === input.candidateCode;
    if (!touchesA) continue;

    const otherCode =
      rule.procedureCodeA === input.candidateCode
        ? rule.procedureCodeB
        : rule.procedureCodeA;

    for (const slot of existing) {
      if (slot.procedureCode !== otherCode) continue;

      if (rule.ruleType === 'FORBID_SAME_DAY' && sameDay(input.startAt, slot.startAt)) {
        violations.push({
          ruleType: rule.ruleType,
          procedureCodeA: rule.procedureCodeA,
          procedureCodeB: rule.procedureCodeB,
          message: `${input.candidateCode} cannot be on the same day as ${otherCode}`,
        });
      }

      if (rule.ruleType === 'FORBID_SEQUENCE') {
        const aBeforeB =
          slot.procedureCode === rule.procedureCodeA &&
          input.candidateCode === rule.procedureCodeB &&
          input.startAt >= slot.startAt;
        const bBeforeA =
          slot.procedureCode === rule.procedureCodeB &&
          input.candidateCode === rule.procedureCodeA &&
          slot.startAt >= input.startAt;
        if (aBeforeB || bBeforeA) {
          violations.push({
            ruleType: rule.ruleType,
            procedureCodeA: rule.procedureCodeA,
            procedureCodeB: rule.procedureCodeB,
            message: `Sequence forbidden: ${rule.procedureCodeA} ↔ ${rule.procedureCodeB}`,
          });
        }
      }

      if (rule.ruleType === 'MIN_HOURS_GAP') {
        const gap = hoursBetween(input.startAt, slot.endAt);
        const minH = rule.minHours ?? 24;
        if (gap < minH) {
          violations.push({
            ruleType: rule.ruleType,
            procedureCodeA: rule.procedureCodeA,
            procedureCodeB: rule.procedureCodeB,
            message: `Minimum ${minH}h gap required between ${rule.procedureCodeA} and ${rule.procedureCodeB}`,
          });
        }
      }
    }
  }

  return violations;
}

export async function listCompatibilityRules() {
  return prisma.procedureCompatibilityRule.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function createCompatibilityRule(input: {
  procedureCodeA: string;
  procedureCodeB: string;
  ruleType: ProcedureCompatibilityRuleType;
  minHours?: number;
  note?: string;
}) {
  return prisma.procedureCompatibilityRule.create({ data: input });
}

export async function deleteCompatibilityRule(id: string) {
  return prisma.procedureCompatibilityRule.delete({ where: { id } });
}
