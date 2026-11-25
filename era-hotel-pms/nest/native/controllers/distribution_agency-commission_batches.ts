/** Lifted from era-hotel-pms/nest/generated/distribution_agency-commission_batches.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { todayBakuYmd } from '@era/satellite-kit/time';
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { createCommissionBatch } from '@/lib/services/agency-commission.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const schema = z.object({
  agencyId: z.string().min(1),
  periodFrom: z.string().min(8).optional(),
  periodTo: z.string().min(8).optional(),
  lineIds: z.array(z.string().min(1)).optional(),
});


@Controller()
export class DistributionAgencyCommissionBatchesController {
  @Post("api/distribution/agency-commission/batches")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.AGENCY_COMMISSION_ADMIN);
    const body = schema.parse(httpReq.body);
    const from = body.periodFrom ?? todayBakuYmd();
    const to = body.periodTo ?? from;
    const batch = await createCommissionBatch({
      agencyId: body.agencyId,
      periodFromYmd: from,
      periodToYmd: to,
      lineIds: body.lineIds,
    });
    return sendJson(httpRes, serialize(batch));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
