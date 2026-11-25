import { Controller, Get, HttpCode, Req, UseGuards } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
} from "../../bridge";
import { getSubscriptionMe } from "@/integration/control-plane-platform.client";

@Controller()
export class PlatformBillingSnapshotController {

  @UseGuards(ClinicApiGuard)
  @Get("api/platform/billing-snapshot")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {


  
    if (!session?.organizationId?.trim()) {
      return {
        skipped: true,
        reason: "session organizationId required",
      };
    }
    const organizationId = session.organizationId.trim();
    const snapshot = await getSubscriptionMe({ organizationId });
    return snapshot;
  
        });
  }
}
