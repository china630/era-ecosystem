import { Controller, Get, HttpCode, Req, UseGuards } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { isWalkInDeferredToHub } from "@/lib/billing-router";

@Controller()
export class BillingContextController {

  @UseGuards(ClinicApiGuard)
  @Get("api/billing/context")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {


  
    const denied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_BILLING_READ,
    );
    if (denied) return clinicBody(denied);

    const deferWalkInToHub = await isWalkInDeferredToHub();
    return { deferWalkInToHub };
  
        });
  }
}
