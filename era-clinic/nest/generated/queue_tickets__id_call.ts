import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { callQueueTicket } from "@/domain/appointment/appointment-calendar.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const patchSchema = z.object({
  desk: z.string().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.patch("/api/queue/tickets/:id/call", async (httpReq, httpRes) => {
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

  
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_QUEUE);
    if (denied) return denied;

    const { id } = httpReq.params;
    const body = patchSchema.parse(httpReq.body);
    const result = await callQueueTicket(id, body.desk);
    if (result.kind === "not_found") return sendJson(httpRes, { error: "Queue ticket not found" }, 404);
    if (result.kind === "bad_status") {
      return sendJson(httpRes, { error: `Cannot call ticket in status ${result.status}` }, 400);
    }
    return sendJson(httpRes, result.ticket);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
