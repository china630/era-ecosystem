import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { recordCatalogPriceIfChanged } from "@/domain/catalog/catalog-price-history";
import { pushClinicSkusToFinance, fetchFinanceServiceCatalog, upsertServiceCatalogFinanceRows } from "@/lib/services/clinic-master-data.service";
import { requestOrganizationId } from "@/lib/request-organization";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/catalog/sync", async (httpReq, httpRes) => {
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
    const organizationId = requestOrganizationId();
    const pushed = await pushClinicSkusToFinance(organizationId);
    const items = await fetchFinanceServiceCatalog(organizationId);
    if (items.length === 0) {
      return sendJson(httpRes, { synced: 0, pushed, source: "unavailable" });
    }

    await upsertServiceCatalogFinanceRows(organizationId, items);
    for (const item of items) {
      const listAmount = item.amount > 0 ? item.amount : null;
      await recordCatalogPriceIfChanged({
        organizationId,
        code: item.code,
        amount: item.amount,
        listAmount,
      });
    }

    return sendJson(httpRes, { synced: items.length, pushed, source: "finance" });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
