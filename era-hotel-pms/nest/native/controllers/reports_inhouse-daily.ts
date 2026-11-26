/** Lifted from era-hotel-pms/nest/generated/reports_inhouse-daily.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { bakuCivilUtcDate, todayBakuYmd } from '@era/satellite-kit/time';
import { listInhouseDaily } from '@/lib/services/reports.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class ReportsInhouseDailyController {
  @Get("api/reports/inhouse-daily")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.REPORTS_READ);
    const dateStr = requestUrl.searchParams.get('date') ?? todayBakuYmd();
    const date = bakuCivilUtcDate(dateStr);
    return sendJson(httpRes, serialize(await listInhouseDaily(date)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
