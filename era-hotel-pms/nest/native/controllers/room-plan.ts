/** Lifted from era-hotel-pms/nest/generated/room-plan.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { getRoomPlan } from '@/lib/services/room-plan.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const querySchema = z.object({
  from: z.coerce.date().optional(),
  days: z.coerce.number().int().min(1).max(60).optional(),
});


@Controller()
export class RoomPlanController {
  @Get("api/room-plan")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);

    const params = Object.fromEntries(requestUrl.searchParams);
    const { from, days } = querySchema.parse(params);

    return sendJson(httpRes, serialize(await getRoomPlan({ from, days })));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
