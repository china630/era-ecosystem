import { Controller, HttpCode, Post, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { checkInScheduledAppointment } from "@/domain/appointment/appointment-calendar.service";

@Controller()
export class AppointmentsIdCheckInController {

  @UseGuards(ClinicApiGuard)
  @Post("api/appointments/:id/check-in")
  @HttpCode(200)
  async post_0(
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
    const result = await checkInScheduledAppointment(id);
    if (result.kind === "not_found") throw new HttpException({ error: "Appointment not found" }, 404);
    if (result.kind === "bad_status") {
      throw new HttpException({ error: `Cannot check-in from status ${result.status}` }, 400);
    }

    return result.appointment;
  
        });
  }
}
