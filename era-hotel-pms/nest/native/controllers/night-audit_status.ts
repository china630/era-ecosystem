/** Lifted from era-hotel-pms/nest/generated/night-audit_status.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { serialize } from '@/lib/serialize';
import { getNightAuditStatus } from '@/lib/services/night-audit.service';
import { assertAnyPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class NightAuditStatusController {
  @Get("api/night-audit/status")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertAnyPermission(session, [
      PERMISSIONS.NIGHT_AUDIT_RUN,
      PERMISSIONS.REPORTS_READ,
    ]);
    return sendJson(httpRes, serialize(await getNightAuditStatus()));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
