/** Lifted from era-hotel-pms/nest/generated/reservations__id_pricing_post-night.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { postRoomNight } from '@/lib/services/reservation-pricing.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const schema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });


@Controller()
export class ReservationsIdPricingPostNightController {
  @Post("api/reservations/:id/pricing/post-night")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const { id } = httpReq.params;
    const body = schema.parse(httpReq.body);
    return sendJson(httpRes, serialize(await postRoomNight(id, body.date)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
