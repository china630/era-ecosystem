import { computeLeadScore } from "@/lib/lead-score";
import { createLeadSchema, toPrismaPartyData } from "@/lib/lead-schemas";
import { syncContactRef } from "@/lib/lead-party";
import { createLead, listLeads } from "@/lib/leads.service";
import { assertPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { enterCrmStaff, crmNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithCrmTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/leads", async (httpReq, httpRes) => {
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
    assertPermission(session, PERMISSIONS.LEADS_READ);
    const { searchParams } = new URL(req.url);
    const ownerId = searchParams.get("ownerId");
    const mine = searchParams.get("mine") === "true";
    const prospectType = searchParams.get("prospectType");
    const userId = session.sub;

    const where: Record<string, unknown> = {};
    if (mine && userId) where.ownerId = userId;
    else if (ownerId) where.ownerId = ownerId;
    if (
      prospectType === "CUSTOMER" ||
      prospectType === "PARTNER" ||
      prospectType === "OTHER"
    ) {
      where.prospectType = prospectType;
    }

    const sort = searchParams.get("sort");
    const leads = await listLeads({
      where: Object.keys(where).length ? where : undefined,
      orderBy: sort === "score" ? { score: "desc" } : { updatedAt: "desc" },
    });
    const withScores = leads.map((l) => {
      const score =
        l.scoreUpdatedAt != null ? l.score : computeLeadScore(l);
      return { ...l, score };
    });
    return sendJson(httpRes, withScores);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/leads", async (httpReq, httpRes) => {
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
    const raw = httpReq.body;
    const body = createLeadSchema.parse(raw);
    const stage = body.stage ?? "NEW";
    const channel = body.channel ?? "other";
    const partyData = toPrismaPartyData(body, { channel });
    const contactRef = syncContactRef(
      body.contactRef,
      partyData.contactPhone,
      channel,
    );
    if (!contactRef) {
      return sendJson(httpRes, { error: "contactRef or contactPhone required" }, 400);
    }

    const lead = await createLead({
      title: body.title,
      contactRef,
      stage,
      channel,
      ...partyData,
      stageHistory: {
        create: { toStage: stage },
      },
    });
    return sendJson(httpRes, lead, 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
