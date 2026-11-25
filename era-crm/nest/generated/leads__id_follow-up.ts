import { z } from "zod";
import { todayBakuYmd, parseBakuDateTime } from "@era/satellite-kit/time";
import { trySendPlatformNotification } from "@/lib/platform-notify";
import { findLeadById, updateLead } from "@/lib/leads.service";
import { crmNextContactDue } from "@/lib/production-calendar";
import { prisma } from "@/lib/prisma";
import { assertLeadInScope } from "@/lib/integrations/lead-scope";
import { enterCrmStaff, crmNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithCrmTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  nextContactAt: z.string().datetime().optional(),
  offsetBusinessDays: z.coerce.number().int().min(0).max(90).optional(),
  fromDate: z.string().optional(),
  note: z.string().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.patch("/api/leads/:id/follow-up", async (httpReq, httpRes) => {
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
    const body = bodySchema.parse(httpReq.body);
    await assertLeadInScope({
      organizationId: session.organizationId,
      userId: session.sub,
      leadId: String(id),
      permissions: session.permissions ?? [],
      isOwner: session.isOwner === true,
    });
    const lead = await findLeadById(id);
    if (!lead) return sendJson(httpRes, { error: "Lead not found" }, 404);

    let nextContactAt: Date;
    if (body.offsetBusinessDays != null) {
      const from = body.fromDate?.slice(0, 10) ?? todayBakuYmd();
      const dueIso = await crmNextContactDue(from, body.offsetBusinessDays);
      nextContactAt = parseBakuDateTime(dueIso, "09:00:00");
    } else if (body.nextContactAt) {
      nextContactAt = new Date(body.nextContactAt);
    } else {
      return sendJson(httpRes, { error: "nextContactAt or offsetBusinessDays required" }, 400);
    }

    const updated = await updateLead(id, { nextContactAt });

    // Prefer assignee email; fall back to CRM_NOTIFY_RECIPIENT; never lead-<id>@local in prod paths.
    const owner =
      lead.ownerId != null
        ? await prisma.user.findFirst({
            where: { id: lead.ownerId, organizationId: lead.organizationId },
            select: { email: true, fullName: true },
          })
        : null;
    const recipient =
      owner?.email?.trim() ||
      process.env.CRM_NOTIFY_RECIPIENT?.trim() ||
      undefined;
    if (recipient) {
      await trySendPlatformNotification({
        templateKey: "crm.lead.follow_up",
        channel: "EMAIL",
        messageClass: "TRANSACTIONAL",
        recipient,
        sourceEntityType: "crm_lead",
        sourceEntityId: lead.id,
        body: `Follow up scheduled for ${nextContactAt.toISOString()}${body.note ? `: ${body.note}` : ""}`,
        payload: { nextContactAt: nextContactAt.toISOString(), note: body.note },
      });
    }

    await prisma.task.create({
      data: {
        organizationId: lead.organizationId,
        leadId: lead.id,
        assigneeId: lead.ownerId ?? undefined,
        type: "FOLLOW_UP",
        title: body.note?.trim() || `Follow up: ${lead.title}`,
        dueAt: nextContactAt,
      },
    });

    return sendJson(httpRes, updated);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
