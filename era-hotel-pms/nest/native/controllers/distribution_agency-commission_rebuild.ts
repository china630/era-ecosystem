/** Lifted from era-hotel-pms/nest/generated/distribution_agency-commission_rebuild.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { rebuildCheckedOutForOrg, rebuildStay } from '@/lib/services/agency-commission.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const schema = z.object({
  reservationId: z.string().min(1).optional(),
  agencyId: z.string().min(1).optional(),
});


@Controller()
export class DistributionAgencyCommissionRebuildController {
  @Post("api/distribution/agency-commission/rebuild")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.AGENCY_COMMISSION_ADMIN);
    const body = schema.parse((httpReq.body ?? {}));
    if (body.reservationId) {
      return sendJson(httpRes, await rebuildStay(body.reservationId));
    }
    return sendJson(httpRes, await rebuildCheckedOutForOrg({ agencyId: body.agencyId }));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
