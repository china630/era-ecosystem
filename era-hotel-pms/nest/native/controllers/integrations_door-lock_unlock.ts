/** Lifted from era-hotel-pms/nest/generated/integrations_door-lock_unlock.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { getDoorLockAdapter } from '@/lib/integrations/door-lock-adapter';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const bodySchema = z.object({
  roomNumber: z.string(),
  reservationId: z.string().uuid(),
});


@Controller()
export class IntegrationsDoorLockUnlockController {
  @Post("api/integrations/door-lock/unlock")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    if (!(session)) return sendJson(httpRes, { error: 'Unauthorized' }, 401);
    const body = bodySchema.parse(httpReq.body);
    const result = await getDoorLockAdapter().unlockRoom(body);
    return sendJson(httpRes, result);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
