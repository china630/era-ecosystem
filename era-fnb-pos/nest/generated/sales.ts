import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { saleReportForScope } from "@/lib/sales-report";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/sales", async (httpReq, httpRes) => {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
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

  
    const denied = denyUnlessPermission(session, PERMISSIONS.SCREEN_SALES);
    if (denied) return denied;
    const url = new URL(request.url);
    const scope = url.searchParams.get("scope") === "shift" ? "shift" : "today";
    const channelRaw = url.searchParams.get("channel");
    const methodRaw = url.searchParams.get("method");
    const channel = channelRaw === "TAKEAWAY" || channelRaw === "DINE_IN" ? channelRaw : undefined;
    const method =
      methodRaw === "CASH" || methodRaw === "CARD" || methodRaw === "TRANSFER" ? methodRaw : undefined;
    const date = url.searchParams.get("date") ?? undefined;
    const shiftId = url.searchParams.get("shiftId") ?? undefined;
    return sendJson(httpRes, await saleReportForScope(scope, { date, channel, method, shiftId }));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
