import { Controller, HttpCode, Post, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { closeShift, computeShiftReport } from "@/domain/cashier/cashier-shift.service";

@Controller()
export class CashierShiftsIdCloseController {

  @UseGuards(ClinicApiGuard)
  @Post("api/cashier/shifts/:id/close")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {


  try {
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_CASHIER);
    if (denied) return clinicBody(denied);

    const { id } = httpReq.params;
    const report = await computeShiftReport(id);
    const shift = await closeShift(id, session?.sub ?? null);
    return { shift, report };
  } catch (err) {
    if (err instanceof HttpException) throw err;
    if (err instanceof Error && err.message.includes("not found")) {
      throw new HttpException({ error: err.message }, 404);
    }
    if (err instanceof Error && err.message.includes("already closed")) {
      throw new HttpException({ error: err.message }, 400);
    }
    return clinicBody(handleRouteError(err));
  }

        });
  }
}
