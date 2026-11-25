import { z } from "zod";
import { assignLeadOwner, findLeadById, findUserById } from "@/lib/leads.service";
import { assertPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { assertLeadInScope } from "@/lib/integrations/lead-scope";
import { enterCrmStaff, crmNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithCrmTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  ownerId: z.string().nullable(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.patch("/api/leads/:id/assign", async (httpReq, httpRes) => {
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

  
    if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    assertPermission(session, PERMISSIONS.LEADS_ASSIGN);

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

    if (body.ownerId) {
      const owner = await findUserById(body.ownerId, session.organizationId);
      if (!owner) return sendJson(httpRes, { error: "Owner user not found" }, 404);
    }

    const updated = await assignLeadOwner(id, body.ownerId);

    return sendJson(httpRes, updated);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
