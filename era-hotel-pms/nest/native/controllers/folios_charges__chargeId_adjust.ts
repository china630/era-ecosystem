/** Lifted from era-hotel-pms/nest/generated/folios_charges__chargeId_adjust.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { postFolioAdjustment } from '@/lib/services/folio.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const bodySchema = z.object({
  amount: z.number().refine((value) => Number.isFinite(value) && value !== 0, 'Amount must be non-zero'),
  reason: z.string().trim().min(1).max(500),
});


@Controller()
export class FoliosChargesChargeIdAdjustController {
  @Post("api/folios/charges/:chargeId/adjust")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.FOLIO_CHARGE);
    const { chargeId } = httpReq.params;
    const body = bodySchema.parse(httpReq.body);
    const result = await postFolioAdjustment({
      chargeId,
      amount: body.amount,
      reason: body.reason,
      audit: { userId: session?.sub, request: { headers: { get: (name: string) => nestHeader(httpReq, name) } } },
    });
    return sendJson(httpRes, serialize(result));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
