import { ensureProductCacheSeeded } from "@/lib/product-cache-seed";
import { requestOrganizationId } from "@/lib/request-organization";
import { listProductCacheDefault, refreshProductCacheFromFinance, searchProductCache } from "@/lib/product.service";
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/products/search", async (httpReq, httpRes) => {
    if (!(await enterRetailStaff(httpReq, httpRes))) return;
    try {
      const session = await retailNestSession(httpReq);
      const web = await runWithRetailTenant(session, async () => {
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
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    try {
      await refreshProductCacheFromFinance(requestOrganizationId(), q);
    } catch {
      // Finance catalog unavailable: keep the local cache.
    }
    await ensureProductCacheSeeded();
    if (!q) {
      const all = await listProductCacheDefault();
      return sendJson(httpRes, all);
    }

    const products = await searchProductCache(q);
    return sendJson(httpRes, products);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
