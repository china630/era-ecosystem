/** Lifted from era-hotel-pms/nest/generated/housekeeping_discrepancy.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { todayBakuYmd } from '@era/satellite-kit/time';
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { recordDiscrepancy, escalateVisitFlags, listDiscrepanciesWithRooms, clearDiscrepancyForRoom } from '@/lib/services/hk-nafta.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const schema = z.object({
  roomId: z.string().uuid(),
  date: z.string(),
  kind: z.enum(['SKIP', 'SLEEP']).nullable(),
  notes: z.string().optional(),
});


@Controller()
export class HousekeepingDiscrepancyController {
  @Get("api/housekeeping/discrepancy")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const date = requestUrl.searchParams.get('date') ?? todayBakuYmd();
    const withRoom = await listDiscrepanciesWithRooms(date);
    const escalations = await escalateVisitFlags(date);
    return sendJson(httpRes, serialize({ rows: withRoom, escalations }));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/housekeeping/discrepancy")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const body = schema.parse(httpReq.body);
    if (!body.kind) {
      await clearDiscrepancyForRoom(body.roomId, body.date);
      return sendJson(httpRes, { cleared: true });
    }
    return sendJson(httpRes, serialize(await recordDiscrepancy(body.roomId, body.date, body.kind, body.notes)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
