import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { detectSchedulingConflict } from "@/lib/scheduling.service";
import { isWithinShift } from "@/domain/appointment/practitioner-schedule.service";
import { electiveDayDenied } from "@/domain/appointment/elective-day";
import { findAppointmentForReschedule, findPractitionerById, updateAppointmentReschedule } from "@/domain/appointment/appointment-calendar.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  scheduledAt: z.string().datetime(),
  roomCode: z.string().optional(),
  resourceId: z.string().nullable().optional(),
  /** Move to another practitioner (matrix row drop). */
  practitionerId: z.string().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.patch("/api/appointments/:id/reschedule", async (httpReq, httpRes) => {
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

  
    const denied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_APPOINTMENTS_WRITE,
    );
    if (denied) return denied;

    const { id } = httpReq.params;
    const body = bodySchema.parse(httpReq.body);
    const appt = await findAppointmentForReschedule(id);
    if (!appt) return sendJson(httpRes, { error: "Appointment not found" }, 404);

    const scheduledAt = new Date(body.scheduledAt);
    if (await electiveDayDenied(scheduledAt)) {
      return sendJson(httpRes, { error: "Clinic is closed on this date", ...{ code: "CLOSED_DAY" } }, 409);
    }
    const resourceId =
      body.resourceId !== undefined ? body.resourceId : appt.resourceId;

    let practitionerCode = appt.practitioner.code;
    let practitionerId = appt.practitionerId;
    const durationMinutes = appt.durationMinutes || 30;
    if (body.practitionerId && body.practitionerId !== appt.practitionerId) {
      const next = await findPractitionerById(body.practitionerId);
      if (!next || !next.active) return sendJson(httpRes, { error: "Practitioner not found" }, 404);
      practitionerCode = next.code;
      practitionerId = next.id;
    }

    const conflict = await detectSchedulingConflict({
      practitionerCode,
      scheduledAt,
      durationMinutes,
      excludeAppointmentId: id,
      resourceId,
    });
    if (conflict) return sendJson(httpRes, { error: conflict }, 409);

    // CLI-36 — reject slots outside the practitioner's shift rotation.
    const onShift = await isWithinShift(practitionerId, scheduledAt, durationMinutes);
    if (!onShift) return sendJson(httpRes, { error: "Practitioner is not on shift at this time" }, 409);

    const updated = await updateAppointmentReschedule({
      id,
      scheduledAt,
      practitionerId,
      roomCode: body.roomCode?.trim() || appt.roomCode,
      resourceId,
    });
    return sendJson(httpRes, updated);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
