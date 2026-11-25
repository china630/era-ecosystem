import { Controller, Get, HttpCode, Req, UseGuards } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { listActiveLabBlankProfiles } from "@/domain/lab/lab-order-write.service";

@Controller()
export class LabOrdersBlankProfilesController {

  @UseGuards(ClinicApiGuard)
  @Get("api/lab-orders/blank-profiles")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {


  
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_LAB_ORDERS);
    if (denied) return clinicBody(denied);
    const rows = await listActiveLabBlankProfiles();
    return rows;
  
        });
  }
}
