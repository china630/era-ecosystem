import { z } from "zod";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { getPractitionerById, listPractitionerSkills, setPractitionerSkills, auditMasterChange } from "@/lib/services/clinic-master-data.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const putSchema = z.object({
  procedureTypeIds: z.array(z.string().min(1)),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/admin/practitioners/:id/skills", async (httpReq, httpRes) => {
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
    const existing = await getPractitionerById(id);
    if (!existing) return sendJson(httpRes, { error: "Not found" }, 404);
    return sendJson(httpRes, await listPractitionerSkills(id));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.put("/api/admin/practitioners/:id/skills", async (httpReq, httpRes) => {
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
    const existing = await getPractitionerById(id);
    if (!existing) return sendJson(httpRes, { error: "Not found" }, 404);
    const body = putSchema.parse(httpReq.body);
    const rows = await setPractitionerSkills(id, body.procedureTypeIds);
    await auditMasterChange(
      { userId: guard.session.sub, request: req },
      "practitionerSkill",
      id,
      "REPLACE",
      body,
    );
    return sendJson(httpRes, rows);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
