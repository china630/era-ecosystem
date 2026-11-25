import { Controller, Get, HttpCode, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { buildUnifiedBill } from "@/domain/cashier/cashier-bill.service";

@Controller()
export class CashierBillsVisitIdController {

  @UseGuards(ClinicApiGuard)
  @Get("api/cashier/bills/:visitId")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {


  
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_CASHIER);
    if (denied) return clinicBody(denied);

    const { visitId } = httpReq.params;
    const bill = await buildUnifiedBill(visitId);
    if (!bill) throw new HttpException({ error: "Visit not found" }, 404);
    return bill;
  
        });
  }
}
