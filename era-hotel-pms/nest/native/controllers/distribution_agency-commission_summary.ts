/** Lifted from era-hotel-pms/nest/generated/distribution_agency-commission_summary.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { todayBakuYmd } from '@era/satellite-kit/time';
import { assertAnyPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { listCommissionSummary } from '@/lib/services/agency-commission.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class DistributionAgencyCommissionSummaryController {
  @Get("api/distribution/agency-commission/summary")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertAnyPermission(session, [
      PERMISSIONS.REPORTS_READ,
      PERMISSIONS.SCREEN_DISTRIBUTION,
    ]);
    const url = requestUrl;
    const from = url.searchParams.get('from') ?? todayBakuYmd();
    const to = url.searchParams.get('to') ?? from;
    return sendJson(httpRes, await listCommissionSummary(from, to));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
