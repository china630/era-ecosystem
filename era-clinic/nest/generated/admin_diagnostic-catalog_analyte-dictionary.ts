import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { searchAnalyteDictionary } from "@/domain/catalog/diagnostic-catalog-admin.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/admin/diagnostic-catalog/analyte-dictionary", async (httpReq, httpRes) => {
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
    const q = url.searchParams.get("q") ?? "";
    const limit = Number(url.searchParams.get("limit") ?? "30");
    const rows = await searchAnalyteDictionary(q, Number.isFinite(limit) ? limit : 30);
    return sendJson(httpRes, {
      items: rows.map((row) => ({
        code: row.code,
        unit: row.unit,
        labelEn: row.labelEn,
        labelRu: row.labelRu,
        labelAz: row.labelAz,
        refMin: row.refMin,
        refMax: row.refMax,
        section: row.section,
        valueType: row.valueType,
        optionsJson: row.optionsJson,
      })),
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
