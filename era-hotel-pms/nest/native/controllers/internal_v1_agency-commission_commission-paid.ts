/** Lifted from era-hotel-pms/nest/generated/internal_v1_agency-commission_commission-paid.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { applyCommissionPaid, findAgencyCommissionBatchById } from '@/lib/services/agency-commission.service';
import { enterRequestTenant } from '@/lib/request-organization';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const bodySchema = z.object({
  organizationId: z.string().uuid(),
  batchId: z.string().min(1).optional(),
  lineIds: z.array(z.string().min(1)).optional(),
  financePayableId: z.string().min(1),
  paymentId: z.string().min(1),
  currency: z.literal('AZN').optional(),
});

/**
 * Finance → Hotel: mark commission batch/lines PAID after AP bank payment.
 * Idempotent by financePayableId on batch when already PAID.
 */


@Controller()
export class InternalV1AgencyCommissionCommissionPaidController {
  @Post("api/internal/v1/agency-commission/commission-paid")
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

    if (body.batchId) {
      const batch = await findAgencyCommissionBatchById(body.batchId);
      if (!batch) {
        return sendJson(httpRes, { error: 'Batch not found' }, 404);
      }
      if (batch.status === 'PAID' && batch.financePayableId === body.financePayableId) {
        return sendJson(httpRes, { alreadyApplied: true, batchId: batch.id, paymentId: body.paymentId });
      }
    }

    const result = await applyCommissionPaid({
      batchId: body.batchId,
      lineIds: body.lineIds,
      financePayableId: body.financePayableId,
      paymentRef: body.paymentId,
    });
    return sendJson(httpRes, { ...result, alreadyApplied: false });
  
        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
