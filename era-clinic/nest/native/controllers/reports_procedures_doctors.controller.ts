import { Controller, Get, HttpCode, Req, UseGuards } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { listProcedureReportDoctors } from "@/domain/reports/procedure-report.service";


/** Doctors for the procedure report filter. Same permission as the report itself. */

@Controller()
export class ReportsProceduresDoctorsController {

  @UseGuards(ClinicApiGuard)
  @Get("api/reports/procedures/doctors")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {


  
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_REPORTS_PROCEDURES);
    if (denied) return clinicBody(denied);
    if (!session) return { items: [] };

    const items = await listProcedureReportDoctors(session.organizationId);
    return { items };
  
        });
  }
}
