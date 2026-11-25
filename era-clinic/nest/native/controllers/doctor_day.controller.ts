import { Controller, Get, HttpCode, Req, UseGuards } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import { withClinicStaff, clinicBody } from "../../bridge";
import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { todayBakuYmd } from "@/lib/baku-day";
import { getDoctorDayBoard } from "@/domain/appointment/doctor-day.service";

const querySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  practitionerId: z.string().min(1).optional(),
});

@Controller()
export class DoctorDayController {
  @UseGuards(ClinicApiGuard)
  @Get("api/doctor/day")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(
        session,
        CLINIC_PERMISSION.API_APPOINTMENTS_READ,
      );
      if (denied) return clinicBody(denied);

      const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const query = querySchema.parse({
        date: url.searchParams.get("date") ?? undefined,
        practitionerId: url.searchParams.get("practitionerId") ?? undefined,
      });
      const dateYmd = query.date ?? todayBakuYmd();
      return getDoctorDayBoard(session!, dateYmd, query.practitionerId ?? null);
    });
  }
}