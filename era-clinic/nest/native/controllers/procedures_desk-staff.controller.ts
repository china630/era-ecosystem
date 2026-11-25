import { Controller, Get, HttpCode, Req, UseGuards } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { listProcedureDeskStaff } from "@/domain/procedure/procedure-desk-staff";


/** People who work the procedure desk (nurse board), including who matches this login. */

@Controller()
export class ProceduresDeskStaffController {

  @UseGuards(ClinicApiGuard)
  @Get("api/procedures/desk-staff")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {


  
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PROCEDURES_READ);
    if (denied) return clinicBody(denied);
    const staff = await listProcedureDeskStaff();
    const userId = session?.sub ?? null;
    const mine = Boolean(userId && staff.some((row) => row.userId === userId));
    return {
      staff: staff.map((row) => ({
        id: row.id,
        fullName: row.fullName,
        code: row.code,
        staffKind: row.staffKind,
        specialty: row.specialty,
      })),
      mine,
    };
  
        });
  }
}
