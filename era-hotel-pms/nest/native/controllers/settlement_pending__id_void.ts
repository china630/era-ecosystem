/** Lifted from era-hotel-pms/nest/generated/settlement_pending__id_void.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { voidPendingCharge } from '@/lib/services/settlement-hub.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const schema = z.object({
  reason: z.string().min(3),
});


@Controller()
export class SettlementPendingIdVoidController {
  @Post("api/settlement/pending/:id/void")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.FOLIO_VOID);
    const { id } = httpReq.params;
    const body = schema.parse(httpReq.body);
    const voided = await voidPendingCharge(id, body.reason);
    return sendJson(httpRes, serialize(voided));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
