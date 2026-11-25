import { z } from "zod";
import { createInboxThread, findLeadById, listInboxThreadsRecent } from "@/lib/inbox.service";
import { assertLeadInScope, leadScopedRelationWhere } from "@/lib/integrations/lead-scope";
import { enterCrmStaff, crmNestSession, runWithCrmTenant, runWithNestHttp, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const createSchema = z.object({
  channel: z.enum(["whatsapp", "instagram"]),
  externalRef: z.string().min(1),
  leadId: z.string().optional(),
  preview: z.string().optional(),
  lastMessageAt: z.string().datetime().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/inbox", async (httpReq, httpRes) => {
    if (!(await enterCrmStaff(httpReq, httpRes))) return;
    try {
      const session = await crmNestSession(httpReq);
      const web = await runWithCrmTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
          if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
          const scopeWhere = await leadScopedRelationWhere({
            organizationId: session.organizationId,
            userId: session.sub,
            permissions: session.permissions ?? [],
            isOwner: session.isOwner === true,
          });
          const threads = await listInboxThreadsRecent(100, scopeWhere);
          return sendJson(httpRes, threads);
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/inbox", async (httpReq, httpRes) => {
    if (!(await enterCrmStaff(httpReq, httpRes))) return;
    try {
      const session = await crmNestSession(httpReq);
      const web = await runWithCrmTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
          if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
          const body = createSchema.parse(httpReq.body);

          if (body.leadId) {
            await assertLeadInScope({
              organizationId: session.organizationId,
              userId: session.sub,
              leadId: body.leadId,
              permissions: session.permissions ?? [],
              isOwner: session.isOwner === true,
            });
            const lead = await findLeadById(body.leadId, session.organizationId);
            if (!lead) return sendJson(httpRes, { error: "Lead not found" }, 404);
          }

          const thread = await createInboxThread({
            organizationId: session.organizationId,
            channel: body.channel,
            externalRef: body.externalRef,
            leadId: body.leadId,
            preview: body.preview,
            lastMessageAt: body.lastMessageAt
              ? new Date(body.lastMessageAt)
              : new Date(),
          });

          return sendJson(httpRes, thread, 201);
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
