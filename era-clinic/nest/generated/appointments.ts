import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { trySendPlatformNotification } from "@/lib/platform-notify";
import { detectSchedulingConflict, resolveAppointmentDurationMinutes } from "@/lib/scheduling.service";
import { isWithinShift } from "@/domain/appointment/practitioner-schedule.service";
import { requestOrganizationId } from "@/lib/request-organization";
import { bakuDateTimeDisplay } from "@/lib/baku-day";
import { listAppointmentsRecent, resolvePatientForAppointment, findPractitionerByCode, findServiceCatalogLine, createAppointmentWithVisit } from "@/domain/appointment/appointment-calendar.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const createSchema = z
  .object({
    patientRefId: z.string().min(1).optional(),
    patientRefCode: z.string().min(1).optional(),
    practitionerCode: z.string().min(1),
    scheduledAt: z.string().datetime().optional(),
    roomCode: z.string().optional(),
    resourceId: z.string().optional(),
    durationMinutes: z.number().int().min(5).max(240).optional(),
    serviceCode: z.string().trim().min(1).optional(),
    serviceLines: z
      .array(
        z.object({
          serviceCode: z.string(),
          description: z.string(),
          amount: z.number().nonnegative(),
        }),
      )
      .optional(),
  })
  .refine((b) => Boolean(b.patientRefId || b.patientRefCode), {
    message: "patientRefId or patientRefCode required",
  });

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/appointments", async (httpReq, httpRes) => {
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
      CLINIC_PERMISSION.API_APPOINTMENTS_READ,
    );
    if (denied) return denied;

    return sendJson(httpRes, await listAppointmentsRecent());
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/appointments", async (httpReq, httpRes) => {
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

    const body = createSchema.parse(httpReq.body);

    const organizationId = requestOrganizationId();
    const patient = await resolvePatientForAppointment(
      organizationId,
      body.patientRefId,
      body.patientRefCode,
    );
    if (!patient) {
      return sendJson(httpRes, { error: "Patient not found — register the patient first" }, 400);
    }

    const practitioner = await findPractitionerByCode(body.practitionerCode);
    const { practitionerBookableDenied } = await import("@/lib/master-data-gates");
    const mdBlock = practitionerBookableDenied({
      found: Boolean(practitioner),
      active: practitioner?.active,
    });
    if (mdBlock || !practitioner) return sendJson(httpRes, { error: mdBlock ?? "Practitioner not found" }, 400);

    const scheduledAt = body.scheduledAt
      ? new Date(body.scheduledAt)
      : new Date();
    const { electiveDayDenied } = await import("@/domain/appointment/elective-day");
    if (await electiveDayDenied(scheduledAt)) {
      return sendJson(httpRes, { error: "Clinic is closed on this date", ...{ code: "CLOSED_DAY" } }, 409);
    }
    const serviceCode = body.serviceCode ?? body.serviceLines?.[0]?.serviceCode;
    const durationMinutes = await resolveAppointmentDurationMinutes({
      durationMinutes: body.durationMinutes,
      serviceCode,
    });
    let serviceLines = body.serviceLines ?? [];
    if (serviceLines.length === 0 && serviceCode) {
      const catalog = await findServiceCatalogLine(organizationId, serviceCode);
      const list = catalog?.listAmount != null ? Number(catalog.listAmount) : 0;
      const amount = list > 0 ? list : Number(catalog?.amount ?? 0);
      serviceLines = [
        {
          serviceCode,
          description: catalog?.description?.trim() || serviceCode,
          amount: amount > 0 ? amount : 0,
        },
      ];
    }
    const amountNet = serviceLines.reduce((s, l) => s + l.amount, 0);

    const conflict = await detectSchedulingConflict({
      practitionerCode: body.practitionerCode,
      scheduledAt,
      durationMinutes,
      resourceId: body.resourceId ?? null,
    });
    if (conflict) return sendJson(httpRes, { error: conflict }, 409);

    // CLI-36 — reject slots outside the practitioner's shift rotation.
    const onShift = await isWithinShift(
      practitioner.id,
      scheduledAt,
      durationMinutes,
    );
    if (!onShift) return sendJson(httpRes, { error: "Practitioner is not on shift at this time" }, 409);

    const appointment = await createAppointmentWithVisit({
      organizationId,
      patientRefId: patient.id,
      practitionerId: practitioner.id,
      scheduledAt,
      durationMinutes,
      roomCode: body.roomCode?.trim() || null,
      resourceId: body.resourceId || null,
      amountNet,
      serviceLines,
    });

    const phone = patient.phone?.trim();
    if (phone) {
      await trySendPlatformNotification(
        {
          templateKey: "clinic.appointment.confirmed",
          channel: "SMS",
          messageClass: "TRANSACTIONAL",
          recipient: phone,
          sourceEntityType: "appointment",
          sourceEntityId: appointment.id,
          body: `Appointment confirmed ${bakuDateTimeDisplay(scheduledAt)} with ${practitioner.fullName}`,
          payload: { appointmentId: appointment.id, scheduledAt: scheduledAt.toISOString() },
        },
        { organizationId },
      );
    }

    return sendJson(httpRes, appointment, 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
