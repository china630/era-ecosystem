/** Lifted from era-hotel-pms/nest/generated/distribution_agency-commission_batches__id_pay.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { refuseHotelCommissionPay } from '@/lib/services/agency-commission.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

/** Hotel cash pay is forbidden — Finance AP only. */


@Controller()
export class DistributionAgencyCommissionBatchesIdPayController {
  @Post("api/distribution/agency-commission/batches/:id/pay")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.FOLIO_PAYMENT);
    httpReq.params;
    refuseHotelCommissionPay();
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
