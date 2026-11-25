/** Lifted from era-hotel-pms/nest/generated/integration_mock-licensing.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { countActiveNonCrossSystemUsers } from '@/lib/services/hotel-integration-status.service';
import { runWithSatelliteTenant } from '@era/satellite-kit';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class IntegrationMockLicensingController {
  @Post("api/integration/mock-licensing")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    if (!session) {
      throw Object.assign(new Error('Unauthorized'), { status: 401 });
    }
    const body = (httpReq.body ?? {});
    const organizationId = String(body.organizationId ?? session.organizationId ?? 'unknown');
    const limit = parseInt(process.env.LICENSING_SEAT_LIMIT ?? '10', 10);

    const seatsUsed = await runWithSatelliteTenant({ organizationId: session.organizationId }, () =>
      countActiveNonCrossSystemUsers(),
    );

    const allowed = seatsUsed < limit;

    return sendJson(httpRes, {
      allowed,
      organizationId,
      satelliteType: body.satelliteType ?? 'hotel_pms',
      tier: 'Tier1',
      seatsUsed,
      seatsLimit: limit,
      message: allowed
        ? undefined
        : `Quota exceeded (${seatsUsed}/${limit}). Upgrade tier in ERA Finance.`,
    }, allowed ? 200 : 403);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
