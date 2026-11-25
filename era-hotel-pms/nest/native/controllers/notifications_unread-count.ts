/** Lifted from era-hotel-pms/nest/generated/notifications_unread-count.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";

import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

/** In-app notifications stub — integrate with orchestrator CP when available. */


@Controller()
export class NotificationsUnreadCountController {
  @Get("api/notifications/unread-count")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    if (!(session)) return sendJson(httpRes, { error: 'Unauthorized' }, 401);
    return sendJson(httpRes, { count: 0 });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
