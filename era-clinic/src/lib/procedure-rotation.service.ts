import type { ProcedureRotationRule } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { bakuDateKey } from "@/domain/patient/patient-timeline.service";

export type RotationContextSlot = {
  procedureCode: string;
  bodyPart?: string | null;
  startAt: Date;
  endAt: Date;
};

export type RotationEvaluation = {
  ok: boolean;
  mustShift: boolean;
  insertRestCode?: string | null;
  ruleCode?: string;
  message?: string;
};

function dayKey(d: Date): string {
  return bakuDateKey(d);
}

function addDaysKey(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function matchesMember(
  rule: ProcedureRotationRule,
  code: string,
  bodyPart: string | null | undefined,
  slot: RotationContextSlot,
): boolean {
  if (!rule.memberCodes.includes(slot.procedureCode)) return false;
  if (rule.scope === "BODY_PART") {
    if (!bodyPart || !slot.bodyPart) return false;
    return slot.bodyPart === bodyPart && slot.procedureCode === code;
  }
  return true;
}

/**
 * Evaluate consecutive-day rotation for a candidate procedure.
 * BODY_PART: same code + same body part may not run on consecutive days (maxConsecutiveDays=1).
 * GROUP: member codes share a streak; after max days, restProcedureCode is preferred.
 */
export async function evaluateRotation(input: {
  candidateCode: string;
  bodyPart?: string | null;
  day: Date;
  context: RotationContextSlot[];
}): Promise<RotationEvaluation> {
  const rules = await prisma.procedureRotationRule.findMany({
    where: { active: true },
  });
  const candidateDay = dayKey(input.day);

  for (const rule of rules) {
    if (!rule.memberCodes.includes(input.candidateCode)) continue;

    let streak = 0;
    for (let back = 1; back <= rule.maxConsecutiveDays + 1; back++) {
      const prevDay = addDaysKey(candidateDay, -back);
      const hit = input.context.some(
        (s) =>
          dayKey(s.startAt) === prevDay &&
          matchesMember(rule, input.candidateCode, input.bodyPart, s),
      );
      if (!hit) break;
      streak++;
    }

    if (streak >= rule.maxConsecutiveDays) {
      if (rule.restProcedureCode && rule.restProcedureCode !== input.candidateCode) {
        return {
          ok: false,
          mustShift: true,
          insertRestCode: rule.restProcedureCode,
          ruleCode: rule.code,
          message: `Rotation ${rule.code}: max ${rule.maxConsecutiveDays} consecutive day(s); prefer ${rule.restProcedureCode}`,
        };
      }
      return {
        ok: false,
        mustShift: true,
        ruleCode: rule.code,
        message: `Rotation ${rule.code}: max ${rule.maxConsecutiveDays} consecutive day(s) for ${input.candidateCode}`,
      };
    }
  }

  return { ok: true, mustShift: false };
}

export async function listRotationRules() {
  return prisma.procedureRotationRule.findMany({ orderBy: { createdAt: "desc" } });
}

export async function createRotationRule(input: {
  code: string;
  name: string;
  memberCodes: string[];
  scope: "BODY_PART" | "GROUP";
  maxConsecutiveDays: number;
  restProcedureCode?: string | null;
  note?: string | null;
}) {
  return prisma.procedureRotationRule.create({ data: input });
}

export async function updateRotationRule(
  id: string,
  data: {
    name?: string;
    memberCodes?: string[];
    scope?: "BODY_PART" | "GROUP";
    maxConsecutiveDays?: number;
    restProcedureCode?: string | null;
    note?: string | null;
    active?: boolean;
  },
) {
  return prisma.procedureRotationRule.update({ where: { id }, data });
}

export async function deleteRotationRule(id: string) {
  return prisma.procedureRotationRule.delete({ where: { id } });
}
