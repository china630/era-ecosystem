/** Lifted from nest/generated/platform_billing-snapshot.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { getSubscriptionMe } from "@/integration/control-plane-platform.client";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class PlatformBillingSnapshotController {
  @Get("api/platform/billing-snapshot")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const organizationId = (session)?.organizationId;
    if (!organizationId) {
      return sendJson(httpRes, {
        skipped: true,
        reason: "satellite organizationId not bound",
      });
    }
    try {
      const snapshot = await getSubscriptionMe({ organizationId });
      return sendJson(httpRes, snapshot);
    } catch (err) {
      const message = err instanceof Error ? err.message : "billing snapshot failed";
      return sendJson(httpRes, { error: message }, 502);
    }
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
