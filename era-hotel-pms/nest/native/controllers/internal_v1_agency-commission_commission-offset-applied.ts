/** Lifted from era-hotel-pms/nest/generated/internal_v1_agency-commission_commission-offset-applied.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { applyCommissionOffset } from '@/lib/services/agency-commission.service';
import { enterRequestTenant } from '@/lib/request-organization';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const bodySchema = z.object({
  organizationId: z.string().uuid(),
  lineIds: z.array(z.string().min(1)).min(1),
  financeOffsetId: z.string().min(1),
});

/** Finance → Hotel: AR↔AP offset marked commission lines PAID (P3). */


@Controller()
export class InternalV1AgencyCommissionCommissionOffsetAppliedController {
  @Post("api/internal/v1/agency-commission/commission-offset-applied")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  
    const token = process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim();
    const auth = nestHeader(httpReq, 'authorization')?.replace(/^Bearer\s+/i, '').trim();
    if (token && auth !== token) {
      return sendJson(httpRes, { error: 'Unauthorized' }, 401);
    }
    const body = bodySchema.parse(httpReq.body);
    enterRequestTenant(body.organizationId);
    return sendJson(httpRes, 
      await applyCommissionOffset({
        lineIds: body.lineIds,
        financeOffsetId: body.financeOffsetId,
      }),
    );
  
        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
