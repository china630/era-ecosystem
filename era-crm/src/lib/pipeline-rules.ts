import { LeadStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function applyPipelineRules(leadId: string, fromStage: LeadStage | null) {
  const rules = await prisma.pipelineRule.findMany({ where: { active: true } });
  if (!rules.length) return null;

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return null;

  for (const rule of rules) {
    if (rule.triggerStage && rule.triggerStage !== fromStage) continue;
    if (lead.stage === rule.targetStage) continue;
    const updated = await prisma.lead.update({
      where: { id: leadId },
      data: { stage: rule.targetStage },
    });
    await prisma.leadStageHistory.create({
      data: {
        leadId,
        fromStage: lead.stage,
        toStage: rule.targetStage,
      },
    });
    return updated;
  }
  return null;
}
