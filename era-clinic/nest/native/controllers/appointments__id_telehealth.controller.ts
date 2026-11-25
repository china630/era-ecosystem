import { Controller, HttpCode, Post, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import { withClinicStaff, clinicBody } from "../../bridge";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { enableVideoAppointment } from "@/domain/telehealth/telehealth.service";
import { recordClinicAudit } from "@/lib/satellite-audit";

@Controller()
export class AppointmentsIdTelehealthController {
  @UseGuards(ClinicApiGuard)
  @Post("api/appointments/:id/telehealth")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_APPOINTMENTS_WRITE);
      if (denied) return clinicBody(denied);

      const { id } = httpReq.params;
      const result = await enableVideoAppointment(id);
      if (result.kind === "not_found") throw new HttpException({ error: "Appointment not found" }, 404);
      if (result.kind === "module_inactive") {
        throw new HttpException({ error: "clinic_telehealth_inactive" }, 403);
      }
      if (result.kind === "bad_status") {
        throw new HttpException({ error: `Cannot enable video from status ${result.status}` }, 400);
      }

      await recordClinicAudit(
        { userId: session?.sub, request: httpReq },
        "appointment",
        id,
        "TELEHEALTH_ENABLE",
        { mode: "VIDEO", roomUrl: result.appointment.videoRoomUrl },
      );

      return result.appointment;
    });
  }
}