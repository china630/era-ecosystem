import { Controller, HttpCode, Post, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { openShift } from "@/domain/cashier/cashier-shift.service";


/** Legacy open endpoint — delegates to current-shift open (idempotent). */

@Controller()
export class CashierShiftsOpenController {

  @UseGuards(ClinicApiGuard)
  @Post("api/cashier/shifts/open")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {


  
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_CASHIER);
    if (denied) return clinicBody(denied);

    const shift = await openShift(session?.sub ?? null);
    throw new HttpException(shift, 201);
  
        });
  }
}
