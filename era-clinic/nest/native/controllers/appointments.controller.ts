import { Controller, Get, HttpCode, Post, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { trySendPlatformNotification } from "@/lib/platform-notify";
import { detectSchedulingConflict, resolveAppointmentDurationMinutes } from "@/lib/scheduling.service";
import { isWithinShift } from "@/domain/appointment/practitioner-schedule.service";
import { requestOrganizationId } from "@/lib/request-organization";
import { bakuDateTimeDisplay } from "@/lib/baku-day";
import { listAppointmentsRecent, resolvePatientForAppointment, findPractitionerByCode, findServiceCatalogLine, createAppointmentWithVisit } from "@/domain/appointment/appointment-calendar.service";


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

@Controller()
export class AppointmentsController {

  @UseGuards(ClinicApiGuard)
  @Get("api/appointments")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_APPOINTMENTS_READ,
    );
    if (denied) return clinicBody(denied);

    return await listAppointmentsRecent();
  
        });
  }

  @UseGuards(ClinicApiGuard)
  @Post("api/appointments")
  @HttpCode(200)
  async post_1(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_APPOINTMENTS_WRITE,
    );
    if (denied) return clinicBody(denied);

    const body = createSchema.parse(httpReq.body);

    const organizationId = requestOrganizationId();
    const patient = await resolvePatientForAppointment(
      organizationId,
      body.patientRefId,
      body.patientRefCode,
    );
    if (!patient) {
      throw new HttpException({ error: "Patient not found — register the patient first" }, 400);
    }

    const practitioner = await findPractitionerByCode(body.practitionerCode);
    const { practitionerBookableDenied } = await import("@/lib/master-data-gates");
    const mdBlock = practitionerBookableDenied({
      found: Boolean(practitioner),
      active: practitioner?.active,
    });
    if (mdBlock || !practitioner) throw new HttpException({ error: mdBlock ?? "Practitioner not found" }, 400);

    const scheduledAt = body.scheduledAt
      ? new Date(body.scheduledAt)
      : new Date();
    const { electiveDayDenied } = await import("@/domain/appointment/elective-day");
    if (await electiveDayDenied(scheduledAt)) {
      throw new HttpException({ error: "Clinic is closed on this date", ...{ code: "CLOSED_DAY" } }, 409);
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
    if (conflict) throw new HttpException({ error: conflict }, 409);

    // CLI-36 — reject slots outside the practitioner's shift rotation.
    const onShift = await isWithinShift(
      practitioner.id,
      scheduledAt,
      durationMinutes,
    );
    if (!onShift) throw new HttpException({ error: "Practitioner is not on shift at this time" }, 409);

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

    throw new HttpException(appointment, 201);
  
        });
  }
}
