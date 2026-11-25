/** Lifted from era-hotel-pms/nest/generated/housekeeping_stay-linen.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { saveStayLinenOverride } from '@/lib/services/hk-nafta.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const bodySchema = z.object({
  reservationId: z.string().uuid(),
  linenEveryNights: z.number().int().min(1).max(30).nullable(),
  deepEveryNights: z.number().int().min(1).max(30).nullable(),
});


@Controller()
export class HousekeepingStayLinenController {
  @Post("api/housekeeping/stay-linen")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const body = bodySchema.parse(httpReq.body);
    return sendJson(httpRes, 
      serialize(
        await saveStayLinenOverride(body.reservationId, body.linenEveryNights, body.deepEveryNights),
      ),
    );
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
