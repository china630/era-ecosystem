/** Lifted from era-hotel-pms/nest/generated/night-audit_year-end.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getYearEndPreview, runYearEndAction } from '@/lib/services/night-audit-year-end.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const bodySchema = z.object({
  action: z.enum(['LAST_DAY', 'FIRST_DAY']),
});


@Controller()
export class NightAuditYearEndController {
  @Get("api/night-audit/year-end")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.NIGHT_AUDIT_RUN);
    return sendJson(httpRes, serialize(await getYearEndPreview()));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/night-audit/year-end")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.NIGHT_AUDIT_RUN);
    const body = bodySchema.parse(httpReq.body);
    // Honest staged response (200): menu is live, posting not enabled yet.
    return sendJson(httpRes, serialize(await runYearEndAction(body.action, session?.sub)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
