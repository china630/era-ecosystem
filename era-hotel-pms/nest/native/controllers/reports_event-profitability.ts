/** Lifted from era-hotel-pms/nest/generated/reports_event-profitability.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { serialize } from '@/lib/serialize';
import { getEventProfitabilityReport } from '@/lib/services/event-order.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class ReportsEventProfitabilityController {
  @Get("api/reports/event-profitability")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.REPORTS_READ);
    await requireHotelModule('hotel_banquets', session.organizationId);
    const url = requestUrl;
    const fromStr = url.searchParams.get('from');
    const toStr = url.searchParams.get('to');
    return sendJson(httpRes, 
      serialize(
        await getEventProfitabilityReport(
          fromStr ? new Date(fromStr) : undefined,
          toStr ? new Date(toStr) : undefined,
        ),
      ),
    );
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
