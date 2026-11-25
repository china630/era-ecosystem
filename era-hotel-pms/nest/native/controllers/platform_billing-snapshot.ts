/** Lifted from era-hotel-pms/nest/generated/platform_billing-snapshot.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { getSubscriptionMe } from '@/integration/control-plane-platform.client';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class PlatformBillingSnapshotController {
  @Get("api/platform/billing-snapshot")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    const organizationId = (session)?.organizationId;
    if (!organizationId) {
      return sendJson(httpRes, { skipped: true, reason: 'satellite organizationId not bound' });
    }
    const snapshot = await getSubscriptionMe({ organizationId });
    return sendJson(httpRes, snapshot);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
