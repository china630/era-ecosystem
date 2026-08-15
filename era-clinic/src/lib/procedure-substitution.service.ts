import type { BodyPartCode } from "@/lib/body-part-codes";
import { prisma } from "@/lib/prisma";

export type SubstitutionResult = {
  procedureCode: string;
  substituted: boolean;
  originalCode?: string;
};

/**
 * If original procedure body part is contraindicated, pick an active substitute.
 * Quota stays on the program line of the original code (caller responsibility).
 */
export async function resolveProcedureSubstitution(input: {
  procedureCode: string;
  bodyPart?: BodyPartCode | string | null;
  blockedParts: Set<string>;
}): Promise<SubstitutionResult> {
  const blocked =
    input.bodyPart != null && input.blockedParts.has(input.bodyPart);
  if (!blocked) {
    return { procedureCode: input.procedureCode, substituted: false };
  }

  const rules = await prisma.procedureSubstitutionRule.findMany({
    where: { active: true, originalCode: input.procedureCode },
    orderBy: { createdAt: "asc" },
  });

  for (const rule of rules) {
    const subType = await prisma.procedureType.findUnique({
      where: { code: rule.substituteCode },
    });
    if (!subType) continue;
    if (subType.bodyPart && input.blockedParts.has(subType.bodyPart)) continue;
    return {
      procedureCode: rule.substituteCode,
      substituted: true,
      originalCode: input.procedureCode,
    };
  }

  return { procedureCode: input.procedureCode, substituted: false };
}

export async function listSubstitutionRules() {
  return prisma.procedureSubstitutionRule.findMany({ orderBy: { createdAt: "desc" } });
}

export async function createSubstitutionRule(input: {
  originalCode: string;
  substituteCode: string;
  note?: string | null;
}) {
  return prisma.procedureSubstitutionRule.create({ data: input });
}

export async function updateSubstitutionRule(
  id: string,
  data: {
    originalCode?: string;
    substituteCode?: string;
    note?: string | null;
    active?: boolean;
  },
) {
  return prisma.procedureSubstitutionRule.update({ where: { id }, data });
}

export async function deleteSubstitutionRule(id: string) {
  return prisma.procedureSubstitutionRule.delete({ where: { id } });
}
