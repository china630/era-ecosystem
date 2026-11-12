import { computeLeadScore } from "@/lib/lead-score";
import { findLeadWithVisits, updateLeadScore } from "@/lib/leads.service";
import { enterCrmStaff, crmNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithCrmTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/leads/:id/score", async (httpReq, httpRes) => {
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

  
    if (!(session)) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const { id } = httpReq.params;
    const lead = await findLeadWithVisits(id);
    if (!lead) return sendJson(httpRes, { error: "Lead not found" }, 404);
    const score = computeLeadScore(lead);
    const updated = await updateLeadScore(id, score);
    return sendJson(httpRes, updated);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
