import { requestOrganizationId } from "@/lib/request-organization";
import { z } from "zod";
import { LeadStage } from "@prisma/client";
import { validatePartyForStage } from "@/lib/lead-party";
import { findLeadById, updateLeadStage } from "@/lib/leads.service";
import { assertLeadInScope } from "@/lib/integrations/lead-scope";
import { enterCrmStaff, crmNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithCrmTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z
  .object({
    stage: z.nativeEnum(LeadStage).optional(),
    stageId: z.string().min(1).optional(),
    pipelineStageId: z.string().min(1).optional(),
  })
  .refine((b) => Boolean(b.stage || b.stageId || b.pipelineStageId), {
    message: "stage or stageId required",
  });

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.patch("/api/leads/:id/stage", async (httpReq, httpRes) => {
    if (!(await enterCrmStaff(httpReq, httpRes))) return;
    try {
      const session = await crmNestSession(httpReq);
      const web = await runWithCrmTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const req = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    if (!(session)) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const { id } = httpReq.params;
    await assertLeadInScope({
      organizationId: session.organizationId,
      userId: session.sub,
      leadId: String(id),
      permissions: session.permissions ?? [],
      isOwner: session.isOwner === true,
    });
    const lead = await findLeadById(id);
    if (!lead) return sendJson(httpRes, { error: "Lead not found" }, 404);
    const body = bodySchema.parse(httpReq.body);

    const pipelineStageId = body.pipelineStageId ?? body.stageId;
    if (pipelineStageId) {
      const { prisma } = await import("@/lib/prisma");
      const stageRow = await prisma.pipelineStage.findFirst({
        where: {
          id: pipelineStageId,
          organizationId: session.organizationId,
        },
      });
      if (!stageRow) {
        return sendJson(httpRes, { error: "Pipeline stage not found" }, 404);
      }
      const legacy =
        stageRow.legacyStage ??
        (stageRow.kind === "WON"
          ? "WON"
          : stageRow.kind === "LOST"
            ? "LOST"
            : lead.stage);
      const gateError = validatePartyForStage(lead, legacy);
      if (gateError) return sendJson(httpRes, { error: gateError }, 400);
      const { moveLeadToPipelineStage } = await import("@/lib/leads.service");
      const moved = await moveLeadToPipelineStage(String(id), pipelineStageId, {
        authorId: session.sub,
      });
      if (!moved) return sendJson(httpRes, { error: "Pipeline stage not found" }, 404);
      return sendJson(httpRes, moved);
    }

    const stage = body.stage!;
    const gateError = validatePartyForStage(lead, stage);
    if (gateError) return sendJson(httpRes, { error: gateError }, 400);

    const fromStage = lead.stage;
    const updated = await updateLeadStage(id, stage, fromStage, {
      authorId: session.sub,
    });
    // Digital Pipeline lite runs inside updateLeadStage (P1-1).

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

    return sendJson(httpRes, updated);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
