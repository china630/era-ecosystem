/** Lifted from era-hotel-pms/nest/generated/night-audit_run.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { serialize } from '@/lib/serialize';
import { runNightAudit } from '@/lib/services/night-audit.service';
import { QaimeDayCloseBlockedError, QaimeDayCloseUnreachableError } from '@/lib/services/qaime-day-close-gate';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class NightAuditRunController {
  @Post("api/night-audit/run")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  try {
    assertPermission(session, PERMISSIONS.NIGHT_AUDIT_RUN);
    const result = await runNightAudit({ userId: session?.sub, request: { headers: { get: (name: string) => nestHeader(httpReq, name) } } });
    return sendJson(httpRes, serialize(result));
  } catch (err) {
    if (err instanceof QaimeDayCloseBlockedError) {
      return sendJson(httpRes, 
        { error: err.message, code: err.code, gaps: err.gaps }, (
        { status: err.status }).status ?? 200);
    }
    if (err instanceof QaimeDayCloseUnreachableError) {
      return sendJson(httpRes, { error: err.message, code: err.code }, ( { status: err.status }).status ?? 200);
    }
    return sendRouteError(httpRes, err);
  }

      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
