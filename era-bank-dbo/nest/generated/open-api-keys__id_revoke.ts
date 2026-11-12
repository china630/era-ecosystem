import { requireCustomerSession } from "@/lib/api-utils";
import { revokeCorporateApiKey } from "@/lib/open-api-keys";
import { enterDboStaff, dboNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithDboTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/open-api-keys/:id/revoke", async (httpReq, httpRes) => {
    try {
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    const auth = await requireCustomerSession();
    if (auth instanceof Response) return auth;
    if (auth.session.channel !== "CORPORATE") {
      return sendJson(httpRes, { error: "Corporate channel required" }, 403);
    }
    const { id } = httpReq.params;
    const row = await revokeCorporateApiKey(id, auth.session.customerId);
    if (!row) return sendJson(httpRes, { error: "API key not found" }, 404);
    return sendJson(httpRes, { id: row.id, status: row.status });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
