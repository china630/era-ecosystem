import { z } from "zod";
import { NextResponse } from "next/server";
import { createBookingAppointment } from "@era/satellite-kit";
import { requestOrganizationId } from "@/lib/request-organization";
import { resolveAppointmentDurationMinutes } from "@/lib/scheduling.service";
import { electiveDayDenied } from "@/domain/appointment/elective-day";
import { findPractitionerByCode, createScheduledBookingAppointment } from "@/domain/appointment/appointment-calendar.service";
import { findOrCreateBookingPatientStub } from "@/domain/patient/patient.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const schema = z.object({
  customerRef: z.string().min(1).max(64),
  customerName: z.string().min(1).max(200),
  customerPhone: z.string().max(32).optional(),
  scheduledAt: z.string().datetime(),
  practitionerCode: z.string().min(1).max(64).default("GP-01"),
});

/**
 * SEC-CLI-02: public booking may create a pending appointment only.
 * Does not create visits, practitioners, or MDM-linked patient intake.
 */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/booking/appointments", async (httpReq, httpRes) => {
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
    const enabled = process.env.CLINIC_PUBLIC_BOOKING_ENABLED?.trim();
    if (process.env.NODE_ENV === "production" && enabled !== "true") {
      return sendJson(httpRes, 
        { error: "Public booking disabled" }, 403);
    }

    const body = schema.parse(httpReq.body);
    if (await electiveDayDenied(new Date(body.scheduledAt))) {
      return sendJson(httpRes, 
        { error: "Clinic is closed on this date", code: "CLOSED_DAY" }, 409);
    }
    let orgId: string | undefined;
    try {
      const id = requestOrganizationId();
      orgId = id === "demo-org" ? undefined : id;
    } catch {
      orgId = undefined;
    }

    if (orgId) {
      await createBookingAppointment(
        {
          resourceKey: `clinic:${body.practitionerCode}`,
          customerRef: body.customerRef,
          customerName: body.customerName,
          customerPhone: body.customerPhone,
          scheduledAt: body.scheduledAt,
          metadata: { source: "clinic_web_booking" },
        },
        { organizationId: orgId },
      ).catch(() => null);
    }

    const practitioner = await findPractitionerByCode(body.practitionerCode);
    if (!practitioner) {
      return sendJson(httpRes, 
        { error: "Practitioner not found" }, 404);
    }

    // Pending patient stub — no MDM link from public path
    const organizationId = requestOrganizationId();
    const patient = await findOrCreateBookingPatientStub({
      organizationId,
      refCode: body.customerRef,
      fullName: body.customerName,
      phone: body.customerPhone,
    });
    if (!patient) throw new Error("Failed to ensure patient ref");

    const appointment = await createScheduledBookingAppointment({
      organizationId,
      patientRefId: patient.id,
      practitionerId: practitioner.id,
      scheduledAt: new Date(body.scheduledAt),
      durationMinutes: await resolveAppointmentDurationMinutes({}),
    });

    return sendJson(httpRes, { appointment }, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "booking failed";
    return sendJson(httpRes, { error: msg }, 400);
  }

        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
