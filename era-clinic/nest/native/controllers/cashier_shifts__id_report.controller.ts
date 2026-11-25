import { Controller, Get, HttpCode, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { computeShiftReport, getClinicShiftById } from "@/domain/cashier/cashier-shift.service";


/** X-report: live totals for an open (or any) shift without closing. */

@Controller()
export class CashierShiftsIdReportController {

  @UseGuards(ClinicApiGuard)
  @Get("api/cashier/shifts/:id/report")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {


  
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_CASHIER);
    if (denied) return clinicBody(denied);

    const { id } = httpReq.params;
    const shift = await getClinicShiftById(id);
    if (!shift) throw new HttpException({ error: "Shift not found" }, 404);
    const report = await computeShiftReport(id);
    return { shift, report, kind: "X" };
  
        });
  }
}
