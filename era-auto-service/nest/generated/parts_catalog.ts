import { listPartsCatalogEntries } from "@/lib/parts-catalog.service";
import { enterAutoStaff, autoNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithAutoTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/parts/catalog", async (httpReq, httpRes) => {
    if (!(await enterAutoStaff(httpReq, httpRes))) return;
    try {
      const session = await autoNestSession(httpReq);
      const web = await runWithAutoTenant(session, async () => {
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
    const vin = new URL(req.url).searchParams.get("vin") ?? "";
    const mockUrl = process.env.TECDOC_MOCK_URL;
    if (mockUrl && vin) {
      const res = await fetch(`${mockUrl}?vin=${encodeURIComponent(vin)}`).catch(() => null);
      if (res?.ok) {
        const data = httpReq.body;
        return sendJson(httpRes, { source: "tecdoc_mock", items: data });
      }
    }
    const items = await listPartsCatalogEntries(vin);
    return sendJson(httpRes, { source: "local", items });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
