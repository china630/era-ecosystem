import { Controller, Get, HttpCode, Req, UseGuards } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import { withClinicStaff, clinicBody } from "../../bridge";
import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { insuranceServicesReport } from "@/domain/insurance/insurance-referral.service";
import { requireClinicModule } from "@/lib/clinic-module-gate";
import { requestOrganizationId } from "@/lib/request-organization";
import { todayBakuYmd, addBakuDays } from "@/lib/baku-day";

const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

@Controller()
export class ReportsInsuranceController {
  @UseGuards(ClinicApiGuard)
  @Get("api/reports/insurance")
  @HttpCode(200)
  async getReport(@Req() httpReq: Request) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_REPORTS_PROCEDURES);
      if (denied) return clinicBody(denied);
      await requireClinicModule("clinic_insurance", requestOrganizationId());
      const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const query = querySchema.parse({
        from: url.searchParams.get("from") ?? undefined,
        to: url.searchParams.get("to") ?? undefined,
      });
      const to = query.to ?? todayBakuYmd();
      const from = query.from ?? addBakuDays(to, -30);
      return insuranceServicesReport(from, to);
    });
  }
}