import { searchFinanceCatalog } from "@era/satellite-kit";
import { assertPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requestOrganizationId } from "@/lib/request-organization";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

/**
 * Finance sku picker. Minibar stays goods-only.
 * Consumption passes includeServices=1 so a service sku with a recipe can be the norm.
 */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/housekeeping/finance-products", async (httpReq, httpRes) => {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {
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

  
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const includeServices = url.searchParams.get("includeServices") === "1";
    const limitRaw = Number.parseInt(url.searchParams.get("limit") ?? "30", 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 30;
    const result = await searchFinanceCatalog({
      organizationId: requestOrganizationId(),
      search: q,
      isService: includeServices ? undefined : false,
      limit,
      channel: "HOTEL",
    });
    return sendJson(httpRes, {
      items: result.items.map((p) => ({
        value: p.sku,
        label: `${p.sku} — ${p.name}`,
        sku: p.sku,
        revenueAccountCode: p.revenueAccountCode,
      })),
      source: result.source,
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
