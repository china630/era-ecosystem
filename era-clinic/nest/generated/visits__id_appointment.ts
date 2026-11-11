import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { electiveDayDenied } from "@/domain/appointment/elective-day";
import { parseBakuDateTime } from "@era/satellite-kit/time";
import { attachNewAppointmentToVisit, getVisitForAppointmentBooking, updateAppointmentSchedule } from "@/domain/visit/visit.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
});

/** Book or move the clock on an existing visit. Does not create a second visit. */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/visits/:id/appointment", async (httpReq, httpRes) => {
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

  
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_VISITS);
    if (denied) return denied;

    const { id } = httpReq.params;
    const body = bodySchema.parse(httpReq.body);
    const visit = await getVisitForAppointmentBooking(id);
    if (!visit) return sendJson(httpRes, { error: "Visit not found" }, 404);
    if (visit.status === "CANCELLED") return sendJson(httpRes, { error: "Visit is cancelled" }, 400);

    const scheduledAt = parseBakuDateTime(body.date, body.time);
    if (await electiveDayDenied(scheduledAt)) {
      return sendJson(httpRes, { error: "Clinic is closed on this date", ...{ code: "CLOSED_DAY" } }, 409);
    }
    if (visit.appointmentId) {
      await updateAppointmentSchedule(visit.appointmentId, scheduledAt);
      return sendJson(httpRes, { visitId: visit.id, scheduledAt: scheduledAt.toISOString() });
    }

    await attachNewAppointmentToVisit(visit, scheduledAt);
    return sendJson(httpRes, { visitId: visit.id, scheduledAt: scheduledAt.toISOString() });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
