import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { assertEpisodeDataScope } from "@/lib/auth/clinic-data-scope";
import { getBathCalendar, saveBathCalendar } from "@/domain/planning/bath-calendar.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  procedureCode: z.string().min(1),
  mode: z.string().regex(/^[0-9A-Z_]{1,16}$/),
  qty: z.number().int().min(0).max(60),
  manualRestYmds: z.array(z.string()).default([]),
  manualBathYmds: z.array(z.string()).default([]),
  bathSequence: z.enum(["SITZ_THEN_FULL"]).nullable().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/sanatorium/episodes/:id/bath-calendar", async (httpReq, httpRes) => {
    if (!(await enterClinicStaff(httpReq, httpRes))) return;
    try {
      const session = await clinicNestSession(httpReq);
      const web = await runWithClinicTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const req = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PROCEDURES_CONFIRM);
    if (denied) return denied;
    const { id } = httpReq.params;
    const scopeDenied = await assertEpisodeDataScope(session, id);
    if (scopeDenied) return scopeDenied;
    return sendJson(httpRes, await getBathCalendar(id));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/sanatorium/episodes/:id/bath-calendar", async (httpReq, httpRes) => {
    if (!(await enterClinicStaff(httpReq, httpRes))) return;
    try {
      const session = await clinicNestSession(httpReq);
      const web = await runWithClinicTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const req = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PROCEDURES_CONFIRM);
    if (denied) return denied;
    const { id } = httpReq.params;
    const scopeDenied = await assertEpisodeDataScope(session, id);
    if (scopeDenied) return scopeDenied;
    const body = bodySchema.parse(httpReq.body);
    return sendJson(httpRes, await saveBathCalendar({ episodeId: id, ...body }));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
