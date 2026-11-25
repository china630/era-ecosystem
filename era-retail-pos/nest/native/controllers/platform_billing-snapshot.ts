/** Lifted from nest/generated/platform_billing-snapshot.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { getSubscriptionMe } from "@/integration/control-plane-platform.client";
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class PlatformBillingSnapshotController {
  @Get("api/platform/billing-snapshot")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterRetailStaff(httpReq, httpRes))) return;
    try {
      const session = await retailNestSession(httpReq);
      const web = await runWithRetailTenant(session, async () => {

  
    const organizationId = (session)?.organizationId;
    if (!organizationId) {
      return sendJson(httpRes, { skipped: true, reason: "satellite organizationId not bound" });
    }
    const snapshot = await getSubscriptionMe({ organizationId });
    return sendJson(httpRes, snapshot);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
