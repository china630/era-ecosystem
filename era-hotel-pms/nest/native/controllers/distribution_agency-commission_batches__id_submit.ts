/** Lifted from era-hotel-pms/nest/generated/distribution_agency-commission_batches__id_submit.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { submitCommissionBatch } from '@/lib/services/agency-commission.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class DistributionAgencyCommissionBatchesIdSubmitController {
  @Post("api/distribution/agency-commission/batches/:id/submit")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.AGENCY_COMMISSION_ADMIN);
    const { id } = httpReq.params;
    return sendJson(httpRes, await submitCommissionBatch(id));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
