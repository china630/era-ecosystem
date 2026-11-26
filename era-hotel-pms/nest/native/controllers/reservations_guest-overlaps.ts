/** Lifted from era-hotel-pms/nest/generated/reservations_guest-overlaps.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { serialize } from '@/lib/serialize';
import { stayCheckIn, stayCheckOut } from '@/lib/hotel-calendar';
import { listDraftGuestOverlaps } from '@/lib/services/reservation.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class ReservationsGuestOverlapsController {
  @Get("api/reservations/guest-overlaps")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    const url = requestUrl;
    const guestId = url.searchParams.get('guestId')?.trim() ?? '';
    const checkIn = url.searchParams.get('checkIn')?.trim() ?? '';
    const checkOut = url.searchParams.get('checkOut')?.trim() ?? '';
    if (!guestId || !checkIn || !checkOut) {
      return sendJson(httpRes, []);
    }
    return sendJson(httpRes, 
      serialize(await listDraftGuestOverlaps([guestId], stayCheckIn(checkIn), stayCheckOut(checkOut))),
    );
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
