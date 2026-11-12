import { dboPaths, engineDboFetch } from "@/lib/engine-dbo-client";
import { requireCustomerSession } from "@/lib/api-utils";
import { enterDboStaff, dboNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithDboTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

type Params = { params: Promise<{ id: string }> };

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/accounts/:id/statement", async (httpReq, httpRes) => {
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

  
    const { id } = httpReq.params;
    const auth = await requireCustomerSession();
    if (auth instanceof Response) return auth;

    const url = new URL(request.url);
    const query = url.searchParams.toString();
    const path = query
      ? `${dboPaths.accountStatement(id)}?${query}`
      : dboPaths.accountStatement(id);

    const data = await engineDboFetch(path, {
      customerJwt: auth.session.customerJwt ?? undefined,
    });
    return sendJson(httpRes, data);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
