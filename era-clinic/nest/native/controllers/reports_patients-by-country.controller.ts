import { Controller, Get, HttpCode, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { patientsByCountryReport } from "@/domain/reports/patients-by-country.service";
import { billingPeriodKeyBaku } from "@era/satellite-kit/time";


const querySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  origin: z.enum(["IN_HOUSE", "WALK_IN"]).optional(),
});

@Controller()
export class ReportsPatientsByCountryController {

  @UseGuards(ClinicApiGuard)
  @Get("api/reports/patients-by-country")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_REPORTS_DIAGNOSES);
    if (denied) return clinicBody(denied);
    if (!session?.organizationId) throw new HttpException({ error: "Unauthorized" }, 401);

    const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    const query = querySchema.parse({
      month: url.searchParams.get("month") ?? undefined,
      origin: url.searchParams.get("origin") ?? undefined,
    });
    const report = await patientsByCountryReport({
      organizationId: session.organizationId,
      periodKey: query.month ?? billingPeriodKeyBaku(),
      origin: query.origin ?? "IN_HOUSE",
    });
    const totals = report.items.reduce(
      (sum, row) => ({
        guests: sum.guests + row.guests,
        nights: sum.nights + row.nights,
        extras: sum.extras + row.extras,
      }),
      { guests: 0, nights: 0, extras: 0 },
    );
    return { ...report, totals };
  
        });
  }
}
