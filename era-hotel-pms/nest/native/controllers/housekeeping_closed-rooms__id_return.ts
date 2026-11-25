/** Lifted from era-hotel-pms/nest/generated/housekeeping_closed-rooms__id_return.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { returnRoomToService } from '@/lib/services/room.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class HousekeepingClosedRoomsIdReturnController {
  @Post("api/housekeeping/closed-rooms/:id/return")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const { id } = httpReq.params;
    return sendJson(httpRes, serialize(await returnRoomToService(id, { userId: session?.sub, request: { headers: { get: (name: string) => nestHeader(httpReq, name) } } })));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
