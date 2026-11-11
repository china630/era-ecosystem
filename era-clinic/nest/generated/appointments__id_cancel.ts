import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { appointmentCancelDenied } from "@/lib/appointment-status-gates";
import { findAppointmentWithVisit, cancelAppointmentWithVisit } from "@/domain/appointment/appointment-calendar.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  reason: z.string().min(1).max(500).optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/appointments/:id/cancel", async (httpReq, httpRes) => {
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

  
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_APPOINTMENTS_WRITE);
    if (denied) return denied;

    const { id } = httpReq.params;
    const body = bodySchema.parse((httpReq.body ?? {}));

    const appt = await findAppointmentWithVisit(id);
    if (!appt) return sendJson(httpRes, { error: "Appointment not found" }, 404);
    if (appt.status === "CANCELLED") return sendJson(httpRes, appt);

    const cancelBlock = appointmentCancelDenied(appt.status);
    if (cancelBlock) return sendJson(httpRes, { error: cancelBlock }, 409);

    const updated = await cancelAppointmentWithVisit(id);
    if (!updated) return sendJson(httpRes, { error: "Appointment not found" }, 404);

    void body.reason;
    return sendJson(httpRes, updated);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
