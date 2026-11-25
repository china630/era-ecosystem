/** Lifted from era-hotel-pms/nest/generated/housekeeping_rotation.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { rotatePairsForDate, ensureFloorPairs, swapRotationPairs, listHkRotationDay } from '@/lib/services/hk-nafta.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const schema = z.object({
  date: z.string(),
  shiftKind: z.enum(['E', 'L', 'N']).optional(),
});


@Controller()
export class HousekeepingRotationController {
  @Get("api/housekeeping/rotation")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const date = requestUrl.searchParams.get('date');
    if (!date) return sendJson(httpRes, serialize(await ensureFloorPairs()));
    return sendJson(httpRes, serialize(await listHkRotationDay(date)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/housekeeping/rotation")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const body = httpReq.body;
    if (body.rowIdA && body.rowIdB) {
      return sendJson(httpRes, serialize(await swapRotationPairs(String(body.rowIdA), String(body.rowIdB))));
    }
    const data = schema.parse(body);
    return sendJson(httpRes, serialize(await rotatePairsForDate(data.date, data.shiftKind ?? 'E')));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
