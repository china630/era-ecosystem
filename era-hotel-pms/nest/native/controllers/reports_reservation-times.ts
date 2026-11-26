/** Lifted from era-hotel-pms/nest/generated/reports_reservation-times.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { hotelDateKey } from '@/lib/hotel-calendar';
import { getCurrentBusinessDate } from '@/lib/services/business-date.service';
import { listReservationTimes } from '@/lib/services/reports.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class ReportsReservationTimesController {
  @Get("api/reports/reservation-times")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.REPORTS_READ);
    const url = requestUrl;
    const bizYmd = hotelDateKey(await getCurrentBusinessDate());
    const from = new Date(url.searchParams.get('from') ?? bizYmd);
    const to = new Date(url.searchParams.get('to') ?? bizYmd);
    const guestQ = url.searchParams.get('guest') ?? undefined;
    const agencyQ = url.searchParams.get('agency') ?? undefined;
    return sendJson(httpRes, serialize(await listReservationTimes({ from, to, guestQ, agencyQ })));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
