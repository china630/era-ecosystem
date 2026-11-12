import { z } from "zod";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { listProcedureTypeRequirements, replaceProcedureTypeRequirements, auditMasterChange, getProcedureTypeById } from "@/lib/services/clinic-master-data.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const requirementSchema = z.object({
  role: z.enum(["LOCATION", "EQUIPMENT", "STAFF"]),
  resourceKind: z.enum(["ROOM", "EQUIPMENT"]).nullable().optional(),
  resourceCode: z.string().nullable().optional(),
  quantity: z.number().int().positive().optional(),
  staffMode: z.enum(["HARD", "SOFT"]).optional(),
  required: z.boolean().optional(),
});

const putSchema = z.object({
  requirements: z.array(requirementSchema),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/admin/procedure-types/:id/requirements", async (httpReq, httpRes) => {
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
    const existing = await getProcedureTypeById(id);
    if (!existing) return sendJson(httpRes, { error: "Not found" }, 404);
    return sendJson(httpRes, await listProcedureTypeRequirements(id));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.put("/api/admin/procedure-types/:id/requirements", async (httpReq, httpRes) => {
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
    const existing = await getProcedureTypeById(id);
    if (!existing) return sendJson(httpRes, { error: "Not found" }, 404);
    const body = putSchema.parse(httpReq.body);
    const rows = await replaceProcedureTypeRequirements(id, body.requirements);
    await auditMasterChange(
      { userId: guard.session.sub, request: req },
      "procedureTypeRequirement",
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
