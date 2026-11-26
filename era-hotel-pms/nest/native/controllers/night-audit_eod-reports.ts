/** Lifted from era-hotel-pms/nest/generated/night-audit_eod-reports.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { todayBakuYmd } from '@era/satellite-kit/time';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getEodReport, type EodReportType } from '@/lib/services/night-audit-eod-reports.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const typeSchema = z.enum([
  'cancelled',
  'created',
  'folio-transactions',
  'room-price-control',
  'no-shows',
  'room-moves',
  'vip-in-house',
]);


@Controller()
export class NightAuditEodReportsController {
  @Get("api/night-audit/eod-reports")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.REPORTS_READ);
    const url = requestUrl;
    const parsed = typeSchema.safeParse(url.searchParams.get('type'));
    if (!parsed.success) {
      return sendJson(httpRes, { error: 
        'type must be cancelled|created|folio-transactions|room-price-control|no-shows|room-moves|vip-in-house' }, 400);
    }
    const today = todayBakuYmd();
    const date = url.searchParams.get('date') ?? today;
    return sendJson(httpRes, serialize(await getEodReport(parsed.data as EodReportType, date)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
