import { computeLeadScore } from "@/lib/lead-score";
import { updateLeadSchema, toPrismaPartyData } from "@/lib/lead-schemas";
import { syncContactRef, validatePartyForStage } from "@/lib/lead-party";
import { findLeadById, findLeadDetailById, updateLead } from "@/lib/leads.service";
import { assertPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { enterCrmStaff, crmNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithCrmTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/leads/:id", async (httpReq, httpRes) => {
    if (!(await enterCrmStaff(httpReq, httpRes))) return;
    try {
      const session = await crmNestSession(httpReq);
      const web = await runWithCrmTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    assertPermission(session, PERMISSIONS.LEADS_READ);
    const { id } = httpReq.params;
    const lead = await findLeadDetailById(id);
    if (!lead) return sendJson(httpRes, { error: "Lead not found" }, 404);
    const score =
      lead.scoreUpdatedAt != null ? lead.score : computeLeadScore(lead);
    return sendJson(httpRes, { ...lead, score });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.patch("/api/leads/:id", async (httpReq, httpRes) => {
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
    assertPermission(session, PERMISSIONS.LEADS_WRITE);
    const { id } = httpReq.params;
    const lead = await findLeadById(id);
    if (!lead) return sendJson(httpRes, { error: "Lead not found" }, 404);

    const body = updateLeadSchema.parse(httpReq.body);
    const partyData = toPrismaPartyData(body, {
      partyKind: lead.partyKind,
      channel: lead.channel,
      prospectType: lead.prospectType,
    });

    const merged = {
      ...lead,
      ...partyData,
      contactRef:
        body.contactRef !== undefined
          ? syncContactRef(
              body.contactRef,
              partyData.contactPhone ?? lead.contactPhone ?? undefined,
              body.channel ?? lead.channel,
            )
          : lead.contactRef,
      title: body.title ?? lead.title,
    };

    const gateError = validatePartyForStage(
      {
        partyKind: merged.partyKind,
        taxId: merged.taxId ?? null,
        companyName: merged.companyName ?? null,
        contactPhone: merged.contactPhone ?? null,
        stage: merged.stage,
      },
      lead.stage,
    );
    if (gateError) return sendJson(httpRes, { error: gateError }, 400);

    const updated = await updateLead(id, {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.contactRef !== undefined
        ? { contactRef: merged.contactRef }
        : {}),
      ...partyData,
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
