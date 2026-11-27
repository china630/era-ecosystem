/** Lifted from era-hotel-pms/nest/generated/mdm_person-ops-profile.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { getPersonOpsProfile } from '@era/satellite-kit';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class MdmPersonOpsProfileController {
  @Get("api/mdm/person-ops-profile")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.GUESTS_READ);
    const globalPersonId = requestUrl.searchParams.get('globalPersonId')?.trim();
    if (!globalPersonId) {
      return sendJson(httpRes, { error: 'globalPersonId query parameter is required' }, 400);
    }
    const profile = await getPersonOpsProfile(globalPersonId);
    if (!profile) {
      return sendJson(httpRes, { error: 'MDM profile not found' }, 404);
    }
    return sendJson(httpRes, profile);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
