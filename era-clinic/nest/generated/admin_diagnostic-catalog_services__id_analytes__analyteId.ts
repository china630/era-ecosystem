import { z } from "zod";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { updateAnalyte, deleteAnalyte } from "@/domain/catalog/diagnostic-catalog-admin.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const boundKindSchema = z.enum([
  "INTERVAL",
  "UPPER_ONLY",
  "LOWER_ONLY",
  "QUALITATIVE",
  "ZONES",
]);

const updateSchema = z.object({
  code: z.string().min(1).optional(),
  unit: z.string().nullable().optional(),
  labelEn: z.string().min(1).optional(),
  labelRu: z.string().min(1).optional(),
  labelAz: z.string().min(1).optional(),
  normTextEn: z.string().nullable().optional(),
  normTextRu: z.string().nullable().optional(),
  normTextAz: z.string().nullable().optional(),
  boundKind: boundKindSchema.optional(),
  refMin: z.string().nullable().optional(),
  refMax: z.string().nullable().optional(),
  refMinFemale: z.string().nullable().optional(),
  refMaxFemale: z.string().nullable().optional(),
  refMinMale: z.string().nullable().optional(),
  refMaxMale: z.string().nullable().optional(),
  zonesJson: z.string().nullable().optional(),
  section: z.string().nullable().optional(),
  valueType: z.enum(["NUMERIC", "QUALITATIVE"]).optional(),
  sortOrder: z.number().int().optional(),
  valueOptions: z
    .array(
      z.object({
        code: z.string().min(1),
        labelEn: z.string().min(1),
        labelRu: z.string().min(1),
        labelAz: z.string().min(1),
        sortOrder: z.number().int().optional(),
      }),
    )
    .optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.patch("/api/admin/diagnostic-catalog/services/:id/analytes/:analyteId", async (httpReq, httpRes) => {
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
    const { analyteId } = httpReq.params;
    const body = updateSchema.parse(httpReq.body);
    const row = await updateAnalyte(
      { userId: guard.session.sub, request: req },
      analyteId,
      body,
    );
    return sendJson(httpRes, row);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.delete("/api/admin/diagnostic-catalog/services/:id/analytes/:analyteId", async (httpReq, httpRes) => {
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
    const { analyteId } = httpReq.params;
    await deleteAnalyte({ userId: guard.session.sub, request: req }, analyteId);
    return sendJson(httpRes, { deleted: true });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
