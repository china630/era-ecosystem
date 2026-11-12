import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { updateBed, deleteBed } from "@/domain/inpatient/ward.service";
import { z } from "zod";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const patchSchema = z.object({
  code: z.string().min(1).optional(),
  status: z.enum(["AVAILABLE", "OCCUPIED", "MAINTENANCE"]).optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.patch("/api/admin/beds/:id", async (httpReq, httpRes) => {
    try {
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    const guard = await assertClinicAdminRoute(request);
    if (guard.error) return guard.error;
    const { id } = httpReq.params;
    const body = patchSchema.parse(httpReq.body);
    const bed = await updateBed(id, body);
    return sendJson(httpRes, { data: bed });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.delete("/api/admin/beds/:id", async (httpReq, httpRes) => {
    try {
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  try {
    const guard = await assertClinicAdminRoute(request);
    if (guard.error) return guard.error;
    const { id } = httpReq.params;
    await deleteBed(id);
    return sendJson(httpRes, { ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Delete failed";
    if (msg.includes("active")) return sendJson(httpRes, { error: msg }, 409);
    return sendRouteError(httpRes, err);
  }

        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
