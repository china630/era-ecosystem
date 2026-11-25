/** Lifted from era-hotel-pms/nest/generated/housekeeping_needed-by.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { todayBakuYmd } from '@era/satellite-kit/time';
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { setNeededByAt } from '@/lib/services/hk-nafta.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const schema = z.object({
  roomId: z.string().uuid(),
  date: z.string(),
  time: z.string().regex(/^\d{2}:\d{2}$/),
});


@Controller()
export class HousekeepingNeededByController {
  @Post("api/housekeeping/needed-by")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const body = schema.parse(httpReq.body);
    if (body.date !== todayBakuYmd()) {
      throw new Error('Cannot edit a floor sheet that is not the business date');
    }
    return sendJson(httpRes, serialize(await setNeededByAt(body.roomId, body.date, body.time)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
