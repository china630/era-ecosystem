/** Lifted from era-hotel-pms/nest/generated/fo_room-type-availability.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { parseHotelNoon } from '@/lib/hotel-calendar';
import { getRoomTypeAvailabilityMatrix } from '@/lib/services/room-type-availability.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class FoRoomTypeAvailabilityController {
  @Get("api/fo/room-type-availability")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    const url = requestUrl;
    const fromStr = url.searchParams.get('from');
    const toStr = url.searchParams.get('to');
    if (!fromStr || !toStr) throw new Error('from and to query params required (YYYY-MM-DD)');
    const from = parseHotelNoon(fromStr);
    const to = parseHotelNoon(toStr);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new Error('Invalid from/to date');
    }
    const data = await getRoomTypeAvailabilityMatrix(from, to);
    return sendJson(httpRes, serialize(data));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
