import { Controller, HttpCode, Patch, Req, Res, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { detectSchedulingConflict } from "@/lib/scheduling.service";
import { isWithinShift } from "@/domain/appointment/practitioner-schedule.service";
import { electiveDayDenied } from "@/domain/appointment/elective-day";
import { findAppointmentForReschedule, findPractitionerById, updateAppointmentReschedule } from "@/domain/appointment/appointment-calendar.service";


const bodySchema = z.object({
  scheduledAt: z.string().datetime(),
  roomCode: z.string().optional(),
  resourceId: z.string().nullable().optional(),
  /** Move to another practitioner (matrix row drop). */
  practitionerId: z.string().optional(),
});

@Controller()
export class AppointmentsIdRescheduleController {

  @UseGuards(ClinicApiGuard)
  @Patch("api/appointments/:id/reschedule")
  @HttpCode(200)
  async patch_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_APPOINTMENTS_WRITE,
    );
    if (denied) return clinicBody(denied);

    const { id } = httpReq.params;
    const body = bodySchema.parse(httpReq.body);
    const appt = await findAppointmentForReschedule(id);
    if (!appt) throw new HttpException({ error: "Appointment not found" }, 404);

    const scheduledAt = new Date(body.scheduledAt);
    if (await electiveDayDenied(scheduledAt)) {
      throw new HttpException({ error: "Clinic is closed on this date", ...{ code: "CLOSED_DAY" } }, 409);
    }
    const resourceId =
      body.resourceId !== undefined ? body.resourceId : appt.resourceId;

    let practitionerCode = appt.practitioner.code;
    let practitionerId = appt.practitionerId;
    const durationMinutes = appt.durationMinutes || 30;
    if (body.practitionerId && body.practitionerId !== appt.practitionerId) {
      const next = await findPractitionerById(body.practitionerId);
      if (!next || !next.active) throw new HttpException({ error: "Practitioner not found" }, 404);
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
    if (conflict) throw new HttpException({ error: conflict }, 409);

    // CLI-36 — reject slots outside the practitioner's shift rotation.
    const onShift = await isWithinShift(practitionerId, scheduledAt, durationMinutes);
    if (!onShift) throw new HttpException({ error: "Practitioner is not on shift at this time" }, 409);

    const updated = await updateAppointmentReschedule({
      id,
      scheduledAt,
      practitionerId,
      roomCode: body.roomCode?.trim() || appt.roomCode,
      resourceId,
    });
    return updated;
  
        });
  }
}
