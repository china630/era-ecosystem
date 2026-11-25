import { Controller, Get, HttpCode, Post, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { computeShiftReport, getCurrentShift, openShift } from "@/domain/cashier/cashier-shift.service";

@Controller()
export class CashierShiftsCurrentController {

  @UseGuards(ClinicApiGuard)
  @Get("api/cashier/shifts/current")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {


  
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_CASHIER);
    if (denied) return clinicBody(denied);

    const shift = await getCurrentShift();
    if (!shift) return { shift: null, report: null };
    const report = await computeShiftReport(shift.id);
    return { shift, report };
  
        });
  }

  @UseGuards(ClinicApiGuard)
  @Post("api/cashier/shifts/current")
  @HttpCode(200)
  async post_1(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_CASHIER);
    if (denied) return clinicBody(denied);

    let bind: { fiscalDeviceId?: string; bankTerminalId?: string } = {};
    try {
      const text = typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "");
      if (text.trim()) {
        const parsed = JSON.parse(text) as {
          fiscalDeviceId?: string;
          bankTerminalId?: string;
        };
        bind = {
          fiscalDeviceId: parsed.fiscalDeviceId,
          bankTerminalId: parsed.bankTerminalId,
        };
      }
    } catch {
      bind = {};
    }

    const shift = await openShift(session?.sub ?? null, bind);
    const report = await computeShiftReport(shift.id);
    throw new HttpException({ shift, report }, 201);
  
        });
  }
}
