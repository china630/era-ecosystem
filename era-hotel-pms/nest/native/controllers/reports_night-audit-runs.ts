/** Lifted from era-hotel-pms/nest/generated/reports_night-audit-runs.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { listNightAuditRunsReport } from '@/lib/services/reports.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class ReportsNightAuditRunsController {
  @Get("api/reports/night-audit-runs")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.NIGHT_AUDIT_RUN);
    const limit = Number(requestUrl.searchParams.get('limit') ?? 100);
    return sendJson(httpRes, serialize(await listNightAuditRunsReport(limit)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
