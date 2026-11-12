import { z } from "zod";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { updateService, deleteService } from "@/domain/catalog/diagnostic-catalog-admin.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const fieldDefSchema = z.object({
  key: z.string().min(1),
  type: z.string().min(1),
  label: z.object({ en: z.string(), ru: z.string(), az: z.string() }),
  unit: z.string().optional(),
  options: z.array(z.string()).optional(),
  required: z.boolean().optional(),
});

const updateSchema = z.object({
  code: z.string().min(1).optional(),
  modalityId: z.string().min(1).optional(),
  category: z.string().optional(),
  kind: z.string().min(1).optional(),
  titleEn: z.string().min(1).optional(),
  titleRu: z.string().min(1).optional(),
  titleAz: z.string().min(1).optional(),
  serviceCode: z.string().min(1).optional(),
  financeSku: z.string().nullable().optional(),
  fields: z.array(fieldDefSchema).nullable().optional(),
  includes: z.array(z.string()).nullable().optional(),
  guestBlankRelease: z.enum(["PAY_WITH_WORK", "AFTER_PAYMENT"]).optional(),
  menuSurface: z.enum(["LAB", "DIAGNOSTIC", "VISIT"]).nullable().optional(),
  autoPaidOnOpen: z.boolean().optional(),
  schedulingMode: z.enum(["FIXED", "OPEN"]).optional(),
  broughtInMaxDays: z.number().int().min(1).max(365).nullable().optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
  packageOnly: z.boolean().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.patch("/api/admin/diagnostic-catalog/services/:id", async (httpReq, httpRes) => {
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
    const body = updateSchema.parse(httpReq.body);
    const row = await updateService(
      { userId: guard.session.sub, request: req },
      id,
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
  http.delete("/api/admin/diagnostic-catalog/services/:id", async (httpReq, httpRes) => {
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
    await deleteService({ userId: guard.session.sub, request: req }, id);
    return sendJson(httpRes, { deleted: true });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
