import { Controller, HttpCode, Post, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  withClinicHttp,
} from "../../bridge";
import { z } from "zod";

import { createBookingAppointment } from "@era/satellite-kit";
import { requestOrganizationId } from "@/lib/request-organization";
import {
  detectSchedulingConflict,
  resolveAppointmentDurationMinutes,
} from "@/lib/scheduling.service";
import { electiveDayDenied } from "@/domain/appointment/elective-day";
import { isWithinShift } from "@/domain/appointment/practitioner-schedule.service";
import { findPractitionerByCode, createScheduledBookingAppointment } from "@/domain/appointment/appointment-calendar.service";
import { findOrCreateBookingPatientStub } from "@/domain/patient/patient.service";


const schema = z.object({
  customerRef: z.string().min(1).max(64),
  customerName: z.string().min(1).max(200),
  customerPhone: z.string().max(32).optional(),
  scheduledAt: z.string().datetime(),
  practitionerCode: z.string().min(1).max(64).default("GP-01"),
  serviceCode: z.string().trim().min(1).max(64).optional(),
});

/**
 * SEC-CLI-02: public booking may create a pending appointment only.
 * Does not create visits, practitioners, or MDM-linked patient intake.
 */

@Controller()
export class BookingAppointmentsController {

  @Post("api/booking/appointments")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      try {
    const enabled = process.env.CLINIC_PUBLIC_BOOKING_ENABLED?.trim();
    if (process.env.NODE_ENV === "production" && enabled !== "true") {
      throw new HttpException({ error: "Public booking disabled" }, 403);
    }

    const body = schema.parse(httpReq.body);
    if (await electiveDayDenied(new Date(body.scheduledAt))) {
      throw new HttpException({ error: "Clinic is closed on this date", code: "CLOSED_DAY" }, 409);
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
      throw new HttpException({ error: "Practitioner not found" }, 404);
    }

    const scheduledAt = new Date(body.scheduledAt);
    const durationMinutes = await resolveAppointmentDurationMinutes({
      serviceCode: body.serviceCode,
    });

    const onShift = await isWithinShift(
      practitioner.id,
      scheduledAt,
      durationMinutes,
    );
    if (!onShift) {
      throw new HttpException(
        { error: "Practitioner is not on shift at this time", code: "OFF_SHIFT" },
        409,
      );
    }

    const conflict = await detectSchedulingConflict({
      practitionerCode: body.practitionerCode,
      scheduledAt,
      durationMinutes,
    });
    if (conflict) {
      throw new HttpException({ error: conflict, code: "SLOT_TAKEN" }, 409);
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
      scheduledAt,
      durationMinutes,
    });

    throw new HttpException({ appointment }, 201);
  } catch (err) {
    if (err instanceof HttpException) throw err;
    const msg = err instanceof Error ? err.message : "booking failed";
    throw new HttpException({ error: msg }, 400);
  }

        });
  }
}
