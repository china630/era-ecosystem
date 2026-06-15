import { prisma } from "@/lib/prisma";
import type { ProcedureRuleKind } from "@prisma/client";

export async function listProcedureRules() {
  return prisma.procedureRule.findMany({ orderBy: { beforeCode: "asc" } });
}

export async function createProcedureRule(data: {
  beforeCode: string;
  afterCode: string;
  kind?: ProcedureRuleKind;
  minGapMinutes?: number;
}) {
  return prisma.procedureRule.create({
    data: {
      beforeCode: data.beforeCode,
      afterCode: data.afterCode,
      kind: data.kind ?? "SEQUENCE_GAP",
      minGapMinutes: data.minGapMinutes ?? 0,
    },
  });
}

export async function deleteProcedureRule(id: string) {
  await prisma.procedureRule.delete({ where: { id } });
}

export async function updateProcedureRule(
  id: string,
  data: {
    kind?: ProcedureRuleKind;
    minGapMinutes?: number;
  },
) {
  return prisma.procedureRule.update({ where: { id }, data });
}
