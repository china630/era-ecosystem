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
import { electiveDayDenied } from "@/domain/appointment/elective-day";
import { parseBakuDateTime } from "@era/satellite-kit/time";
import { attachNewAppointmentToVisit, getVisitForAppointmentBooking, updateAppointmentSchedule } from "@/domain/visit/visit.service";


const bodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
});

/** Book or move the clock on an existing visit. Does not create a second visit. */

@Controller()
export class VisitsIdAppointmentController {

  @UseGuards(ClinicApiGuard)
  @Post("api/visits/:id/appointment")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_VISITS);
    if (denied) return clinicBody(denied);

    const { id } = httpReq.params;
    const body = bodySchema.parse(httpReq.body);
    const visit = await getVisitForAppointmentBooking(id);
    if (!visit) throw new HttpException({ error: "Visit not found" }, 404);
    if (visit.status === "CANCELLED") throw new HttpException({ error: "Visit is cancelled" }, 400);

    const scheduledAt = parseBakuDateTime(body.date, body.time);
    if (await electiveDayDenied(scheduledAt)) {
      throw new HttpException({ error: "Clinic is closed on this date", ...{ code: "CLOSED_DAY" } }, 409);
    }
    if (visit.appointmentId) {
      await updateAppointmentSchedule(visit.appointmentId, scheduledAt);
      return { visitId: visit.id, scheduledAt: scheduledAt.toISOString() };
    }

    await attachNewAppointmentToVisit(visit, scheduledAt);
    return { visitId: visit.id, scheduledAt: scheduledAt.toISOString() };
  
        });
  }
}
