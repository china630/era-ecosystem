/** Lifted from era-hotel-pms/nest/generated/pms_buffet-guest-nights.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { PERMISSIONS } from '@/lib/auth/permissions';
import { assertPosBridgeOrPermission } from '@/lib/pos-bridge-auth';
import { queryOccupancySeries } from '@/lib/services/reports/monthly-daily-analysis.report';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

/**
 * S2S: daily pax series for F&B buffet guest-nights sync.
 * Uses occupancy series pax (adults+children), not stay-count guestNights.
 */


@Controller()
export class PmsBuffetGuestNightsController {
  @Get("api/pms/buffet-guest-nights")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    const request = {
      url: requestUrl.toString(),
      method: httpReq.method,
      nextUrl: requestUrl,
      headers: { get: (name: string) => nestHeader(httpReq, name) },
      json: async () => httpReq.body,
      text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
    };
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  
    await assertPosBridgeOrPermission({ headers: { get: (name: string) => nestHeader(httpReq, name) }, url: new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").toString() }, PERMISSIONS.REPORTS_READ);

    const url = request.nextUrl;
    const from = url.searchParams.get('from')?.trim() ?? '';
    const to = url.searchParams.get('to')?.trim() ?? '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return sendJson(httpRes, 
        { error: 'from and to (YYYY-MM-DD) are required', code: 'BAD_RANGE' }, 400);
    }
    if (from > to) {
      return sendJson(httpRes, 
        { error: 'from must be ≤ to', code: 'BAD_RANGE' }, 400);
    }

    const series = await queryOccupancySeries(from, to);
    return sendJson(httpRes, {
      from: series.from,
      to: series.to,
      days: series.days.map((d) => ({ date: d.date, pax: d.pax })),
    });
  
        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
