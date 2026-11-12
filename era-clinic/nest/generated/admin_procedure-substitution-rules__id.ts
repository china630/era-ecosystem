import { z } from "zod";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { updateSubstitutionRule } from "@/lib/procedure-substitution.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const patchSchema = z.object({
  originalCode: z.string().min(1).optional(),
  substituteCode: z.string().min(1).optional(),
  note: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.patch("/api/admin/procedure-substitution-rules/:id", async (httpReq, httpRes) => {
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
    const body = patchSchema.parse(httpReq.body);
    return sendJson(httpRes, await updateSubstitutionRule(id, body));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
