/** Lifted from era-hotel-pms/nest/generated/reservations_arrivals.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { serialize } from '@/lib/serialize';
import { listArrivals } from '@/lib/services/reservation.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class ReservationsArrivalsController {
  @Get("api/reservations/arrivals")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    const params = requestUrl.searchParams;
    const dateFrom = params.get('dateFrom') ?? params.get('date');
    const dateTo = params.get('dateTo') ?? dateFrom;
    const arrivals = await listArrivals(dateFrom ?? new Date(), dateTo ?? dateFrom ?? new Date());
    return sendJson(httpRes, serialize(arrivals));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
