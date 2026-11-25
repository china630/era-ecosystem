import { Controller, HttpCode, Post, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { appointmentCancelDenied } from "@/lib/appointment-status-gates";
import { findAppointmentWithVisit, cancelAppointmentWithVisit } from "@/domain/appointment/appointment-calendar.service";


const bodySchema = z.object({
  reason: z.string().min(1).max(500).optional(),
});

@Controller()
export class AppointmentsIdCancelController {

  @UseGuards(ClinicApiGuard)
  @Post("api/appointments/:id/cancel")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_APPOINTMENTS_WRITE);
    if (denied) return clinicBody(denied);

    const { id } = httpReq.params;
    const body = bodySchema.parse((httpReq.body ?? {}));

    const appt = await findAppointmentWithVisit(id);
    if (!appt) throw new HttpException({ error: "Appointment not found" }, 404);
    if (appt.status === "CANCELLED") return appt;

    const cancelBlock = appointmentCancelDenied(appt.status);
    if (cancelBlock) throw new HttpException({ error: cancelBlock }, 409);

    const updated = await cancelAppointmentWithVisit(id);
    if (!updated) throw new HttpException({ error: "Appointment not found" }, 404);

    void body.reason;
    return updated;
  
        });
  }
}
