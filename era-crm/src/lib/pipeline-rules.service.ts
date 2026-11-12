import { prisma } from "@/lib/prisma";
import type { LeadStage, Prisma } from "@prisma/client";

export async function listPipelineRules() {
  return prisma.pipelineRule.findMany({ orderBy: { createdAt: "desc" } });
}

export async function createPipelineRule(data: {
  name: string;
  triggerStage?: LeadStage;
  targetStage: LeadStage;
}) {
  return prisma.pipelineRule.create({ data });
}
