import { Controller, Get, HttpCode, Req, UseGuards } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { listPaidPunchCashiers } from "@/domain/reports/procedure-report.service";


/** Users who already punched at least one paid line. */

@Controller()
export class ReportsPaidPunchesCashiersController {

  @UseGuards(ClinicApiGuard)
  @Get("api/reports/paid-punches/cashiers")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {


  
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_REPORTS_PROCEDURES);
    if (denied) return clinicBody(denied);
    if (!session) return { items: [] };

    const items = await listPaidPunchCashiers(session.organizationId);
    return { items };
  
        });
  }
}
