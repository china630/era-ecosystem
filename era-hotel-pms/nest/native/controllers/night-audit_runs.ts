/** Lifted from era-hotel-pms/nest/generated/night-audit_runs.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { serialize } from '@/lib/serialize';
import { assertAnyPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { listNightAuditRuns } from '@/lib/services/night-audit.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class NightAuditRunsController {
  @Get("api/night-audit/runs")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertAnyPermission(session, [PERMISSIONS.SCREEN_NIGHT_AUDIT, PERMISSIONS.NIGHT_AUDIT_RUN]);
    const url = requestUrl;
    const requested = parseInt(url.searchParams.get('limit') ?? '5', 10);
    const limit = Number.isFinite(requested) ? Math.min(200, Math.max(1, requested)) : 5;
    const runs = await listNightAuditRuns(limit);
    return sendJson(httpRes, serialize(runs));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
