/** Lifted from era-hotel-pms/nest/generated/channel_sync_push.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { bakuCivilUtcDate, todayBakuYmd } from '@era/satellite-kit/time';
import { addHotelDays } from '@/lib/hotel-calendar';
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { pushChannelAvailability } from '@/lib/channel/ota-push.service';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class ChannelSyncPushController {
  @Post("api/channel/sync/push")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.CHANNEL_MANAGE);
    await requireHotelModule('hotel_distribution', session.organizationId);

    const body = z
      .object({
        from: z.string().optional(),
        to: z.string().optional(),
      })
      .parse((httpReq.body ?? {}));

    const from = bakuCivilUtcDate(body.from ?? todayBakuYmd());
    const to = bakuCivilUtcDate(body.to ?? addHotelDays(todayBakuYmd(), 14));

    return sendJson(httpRes, serialize(await pushChannelAvailability(from, to)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
