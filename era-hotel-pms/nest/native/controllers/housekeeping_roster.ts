/** Lifted from era-hotel-pms/nest/generated/housekeeping_roster.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { proposeRosterWeek, setRosterCell, reorderHousekeepers, moveHousekeeperDepartment, listHousekeepersForRoster, getRosterWeekByStart } from '@/lib/services/hk-nafta.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const propose = z.object({ weekStart: z.string(), action: z.literal('propose').optional() });
const cell = z.object({
  cellId: z.string().uuid(),
  kind: z.enum(['E', 'L', 'N', 'OFF', 'EG', 'CUSTOM']),
  customStart: z.string().optional(),
  customEnd: z.string().optional(),
});


@Controller()
export class HousekeepingRosterController {
  @Get("api/housekeeping/roster")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const weekStart = requestUrl.searchParams.get('weekStart');
    if (!weekStart) {
      const maids = await listHousekeepersForRoster();
      return sendJson(httpRes, serialize(maids));
    }
    const week = await getRosterWeekByStart(weekStart);
    return sendJson(httpRes, serialize(week));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/housekeeping/roster")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const body = httpReq.body;
    if (Array.isArray(body.orderedIds)) {
      await reorderHousekeepers(body.orderedIds.map(String));
      return sendJson(httpRes, { ok: true });
    }
    if (body.housekeeperId && body.department) {
      return sendJson(httpRes, 
        serialize(
          await moveHousekeeperDepartment(
            String(body.housekeeperId),
            body.department as 'ROOMS' | 'PUBLIC_AREA' | 'LAUNDRY',
          ),
        ),
      );
    }
    if (body.cellId) {
      const data = cell.parse(body);
      return sendJson(httpRes, serialize(await setRosterCell(data.cellId, data.kind, data.customStart, data.customEnd)));
    }
    const data = propose.parse(body);
    return sendJson(httpRes, serialize(await proposeRosterWeek(data.weekStart)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
