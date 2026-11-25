/** Lifted from era-hotel-pms/nest/generated/channel_sync_pull.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { pullOtaReservations } from '@/lib/channel/ota-pull.service';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class ChannelSyncPullController {
  @Post("api/channel/sync/pull")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.CHANNEL_MANAGE);
    await requireHotelModule('hotel_distribution', session.organizationId);

    const url = requestUrl;
    const sinceParam = url.searchParams.get('since');
    const since = sinceParam ? new Date(sinceParam) : undefined;

    return sendJson(httpRes, serialize(await pullOtaReservations(since)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
