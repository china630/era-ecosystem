/** Lifted from era-hotel-pms/nest/generated/clinic_capacity.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { fetchClinicCapacitySummary } from '@/lib/integration/clinic-capacity-client';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

/** Session proxy for ops UI - server holds CLINIC_BRIDGE_SECRET. */


@Controller()
export class ClinicCapacityController {
  @Get("api/clinic/capacity")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    if (!session) return sendJson(httpRes, { error: 'Unauthorized' }, 401);
    const url = requestUrl;
    const date = url.searchParams.get('date');
    const ref = date ? new Date(date) : new Date();
    const summary = await fetchClinicCapacitySummary(session.organizationId, ref);
    if (!summary) {
      return sendJson(httpRes, { riskLevel: 'ok', bookingAllowed: true, configured: false });
    }
    return sendJson(httpRes, { ...summary, configured: true });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
