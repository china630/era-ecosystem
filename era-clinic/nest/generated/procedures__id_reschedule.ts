import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { receptionRescheduleProcedure } from "@/domain/procedure/procedure-attendance.service";
import { evaluateAndPublishCapacity } from "@/lib/capacity.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const schema = z.object({
  scheduledAt: z.string().datetime(),
  resourceId: z.string().optional(),
  allowOtherDay: z.boolean().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.patch("/api/procedures/:id/reschedule", async (httpReq, httpRes) => {
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

  
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PROCEDURES_RECEPTION);
    if (denied) return denied;

    const { id } = httpReq.params;
    const body = schema.parse(httpReq.body);
    const updated = await receptionRescheduleProcedure(
      id,
      new Date(body.scheduledAt),
      { userId: session!.sub, canOverrideCheckIn: false },
      { resourceId: body.resourceId, allowOtherDay: body.allowOtherDay },
    );
    void evaluateAndPublishCapacity().catch(() => null);
    return sendJson(httpRes, updated);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
