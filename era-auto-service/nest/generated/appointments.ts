import { z } from "zod";
import { bakuDateKey, bakuTimeLabel, parseBakuDateTime } from "@era/satellite-kit/time";
import { appointmentCreateDenied } from "@/lib/appointment-gates";
import { nextServiceAppointmentDay } from "@/lib/production-calendar";
import { createAppointment, listAppointments } from "@/lib/appointment.service";
import { enterAutoStaff, autoNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithAutoTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const createSchema = z.object({
  vehiclePlate: z.string().min(1),
  customerName: z.string().optional(),
  scheduledAt: z.string().datetime().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/appointments", async (httpReq, httpRes) => {
    if (!(await enterAutoStaff(httpReq, httpRes))) return;
    try {
      const session = await autoNestSession(httpReq);
      const web = await runWithAutoTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    if (!(session)) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const appointments = await listAppointments();
    return sendJson(httpRes, appointments);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/appointments", async (httpReq, httpRes) => {
    if (!(await enterAutoStaff(httpReq, httpRes))) return;
    try {
      const session = await autoNestSession(httpReq);
      const web = await runWithAutoTenant(session, async () => {
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

  
    if (!(session)) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const body = createSchema.parse(httpReq.body);
    const denied = appointmentCreateDenied(body);
    if (denied) return sendJson(httpRes, { error: denied }, 400);
    let scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : new Date();
    const iso = bakuDateKey(scheduledAt);
    const snappedIso = await nextServiceAppointmentDay(iso);
    if (snappedIso !== iso) {
      scheduledAt = parseBakuDateTime(snappedIso, bakuTimeLabel(scheduledAt));
    }
    const appointment = await createAppointment({
      vehiclePlate: body.vehiclePlate,
      customerName: body.customerName,
      scheduledAt,
    });
    return sendJson(httpRes, { ...appointment, calendarAdjusted: snappedIso !== iso }, 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
