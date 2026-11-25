/** Lifted from era-hotel-pms/nest/generated/settlement_pending_summary.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getPendingSummary } from '@/lib/services/settlement-hub.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class SettlementPendingSummaryController {
  @Get("api/settlement/pending/summary")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.NIGHT_AUDIT_RUN);
    const summary = await getPendingSummary();
    return sendJson(httpRes, serialize(summary));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
