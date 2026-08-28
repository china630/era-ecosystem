import { requestOrganizationId } from "@/lib/request-organization";
import { z } from "zod";
import { LeadStage } from "@prisma/client";
import { jsonOk, jsonError, handleRouteError, assertCrmEntitled } from "@/lib/api-utils";
import { validatePartyForStage } from "@/lib/lead-party";
import { prisma } from "@/lib/prisma";
import { applyPipelineRules } from "@/lib/pipeline-rules";

const bodySchema = z.object({
  stage: z.nativeEnum(LeadStage),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertCrmEntitled();
    const { id } = await params;
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return jsonError("Lead not found", 404);
    const body = bodySchema.parse(await req.json());

    const gateError = validatePartyForStage(lead, body.stage);
    if (gateError) return jsonError(gateError, 400);

    const fromStage = lead.stage;
    const updated = await prisma.lead.update({
      where: { id },
      data: { stage: body.stage },
    });
    await prisma.leadStageHistory.create({
      data: { leadId: id, fromStage, toStage: body.stage },
    });
    await applyPipelineRules(id, body.stage);

    if (process.env.WHATSAPP_BUSINESS_MODE === "live" && updated.contactRef) {
      const orch = process.env.ORCHESTRATOR_API_URL?.replace(/\/$/, "");
      const orgId = requestOrganizationId();
      if (orch && orgId) {
        await fetch(`${orch}/platform/notifications/v1/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.CRM_ORCH_SERVICE_TOKEN ?? ""}`,
            "X-Organization-Id": orgId,
          },
          body: JSON.stringify({
            channel: "WHATSAPP",
            recipient: updated.contactRef,
            templateKey: "lead_stage",
            payload: {
              subject: `stage_${body.stage}`,
              body: `Lead moved to ${body.stage}`,
            },
          }),
        }).catch(() => undefined);
      }
    }

    return jsonOk(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
