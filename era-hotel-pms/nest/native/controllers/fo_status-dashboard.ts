/** Lifted from era-hotel-pms/nest/generated/fo_status-dashboard.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { serialize } from '@/lib/serialize';
import { assertAnyPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { hotelDateKey } from '@/lib/hotel-calendar';
import { getCurrentBusinessDate } from '@/lib/services/business-date.service';
import { getFoStatusDashboard } from '@/lib/services/fo-status-dashboard.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const YMD = /^\d{4}-\d{2}-\d{2}$/;


@Controller()
export class FoStatusDashboardController {
  @Get("api/fo/status-dashboard")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertAnyPermission(session, [PERMISSIONS.REPORTS_READ, PERMISSIONS.RESERVATIONS_READ]);
    const url = requestUrl;
    const dateParam = url.searchParams.get('date');
    const day =
      dateParam && YMD.test(dateParam)
        ? dateParam
        : hotelDateKey(await getCurrentBusinessDate());
    const includeWaiting = url.searchParams.get('waiting') === '1';
    const withRevenue = url.searchParams.get('revenue') === '1';
    return sendJson(httpRes, 
      serialize(
        await getFoStatusDashboard(session.organizationId, day, { includeWaiting, withRevenue }),
      ),
    );
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
