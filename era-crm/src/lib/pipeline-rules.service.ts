import { prisma } from "@/lib/prisma";
import type { LeadStage } from "@prisma/client";

export async function listPipelineRules(organizationId: string) {
  return prisma.pipelineRule.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });
}

export async function updatePipelineRule(
  organizationId: string,
  ruleId: string,
  data: {
    name?: string;
    actionJson?: Record<string, unknown>;
    active?: boolean;
  },
) {
  const row = await prisma.pipelineRule.findFirst({
    where: { id: ruleId, organizationId },
  });
  if (!row) return null;
  let actionJson = row.actionJson;
  if (data.actionJson) {
    const prev = JSON.parse(row.actionJson || "{}") as Record<string, unknown>;
    actionJson = JSON.stringify({ ...prev, ...data.actionJson });
  }
  return prisma.pipelineRule.update({
    where: { id: row.id },
    data: {
      ...(data.name?.trim() ? { name: data.name.trim() } : {}),
      ...(data.actionJson ? { actionJson } : {}),
      ...(typeof data.active === "boolean" ? { active: data.active } : {}),
    },
  });
}

export async function createPipelineRule(
  organizationId: string,
  data: {
    name: string;
    triggerStage?: LeadStage;
    targetStage: LeadStage;
    triggerType?: string;
    configJson?: Record<string, unknown>;
    actionJson?: Record<string, unknown>;
    delayMinutes?: number;
  },
) {
  return prisma.pipelineRule.create({
    data: {
      organizationId,
      name: data.name,
      triggerStage: data.triggerStage,
      targetStage: data.targetStage,
      triggerType: data.triggerType ?? "STAGE_ENTER",
      configJson: JSON.stringify(data.configJson ?? {}),
      actionJson: JSON.stringify(data.actionJson ?? {}),
      delayMinutes: data.delayMinutes ?? 0,
    },
  });
}
