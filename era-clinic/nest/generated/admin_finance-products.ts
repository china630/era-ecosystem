import { searchFinanceCatalog } from "@era/satellite-kit";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

/**
 * Proxy the hotel-parent Finance catalog for SatAdmin pickers.
 * GET /api/admin/finance-products?q=&limit=&isService=true|false
 * Omit isService to return services and goods.
 */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/admin/finance-products", async (httpReq, httpRes) => {
    try {
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const req = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;

    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const limitRaw = Number.parseInt(url.searchParams.get("limit") ?? "20", 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 20;
    const isServiceRaw = url.searchParams.get("isService");
    const isService =
      isServiceRaw === "true" ? true : isServiceRaw === "false" ? false : null;

    const result = await searchFinanceCatalog({
      organizationId: guard.session.organizationId,
      search: q,
      isService,
      limit,
      channel: "CLINIC",
    });

    return sendJson(httpRes, {
      items: result.items.map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        isService: p.isService,
        revenueAccountCode: p.revenueAccountCode,
        value: p.sku,
        label: `${p.sku} — ${p.name}`,
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
