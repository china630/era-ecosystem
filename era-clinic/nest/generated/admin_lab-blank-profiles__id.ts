import { z } from "zod";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { getLabBlankProfileId, setLabBlankProfileActive } from "@/domain/catalog/diagnostic-catalog-admin.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  active: z.boolean(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.patch("/api/admin/lab-blank-profiles/:id", async (httpReq, httpRes) => {
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
    const { id } = httpReq.params;
    const body = bodySchema.parse(httpReq.body);
    const row = await getLabBlankProfileId(id);
    if (!row) return sendJson(httpRes, { error: "Not found" }, 404);
    await setLabBlankProfileActive(id, body.active);
    return sendJson(httpRes, { id, active: body.active });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
