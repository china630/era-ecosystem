import { LeadStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { applyAllPipelineRules } from "@/lib/integrations/pipeline-lite.service";

export async function applyPipelineRules(
  leadId: string,
  enteredStage: LeadStage | null,
  priorStage?: LeadStage | null,
) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return null;
  const applied = await applyAllPipelineRules({
    organizationId: lead.organizationId,
    leadId,
    trigger: "STAGE_ENTER",
    fromStage: priorStage ?? undefined,
    toStage: enteredStage ?? undefined,
  });
  if (!applied) return null;
  return prisma.lead.findUnique({ where: { id: leadId } });
}
