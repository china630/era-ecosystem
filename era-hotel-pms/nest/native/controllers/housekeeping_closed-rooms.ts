/** Lifted from era-hotel-pms/nest/generated/housekeeping_closed-rooms.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { serialize } from '@/lib/serialize';
import { assertAnyPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { listClosedRooms } from '@/lib/services/wave-b-master.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class HousekeepingClosedRoomsController {
  @Get("api/housekeeping/closed-rooms")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertAnyPermission(session, [PERMISSIONS.ROOMS_STATUS, PERMISSIONS.HOUSEKEEPING_MANAGE]);
    return sendJson(httpRes, serialize(await listClosedRooms()));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
