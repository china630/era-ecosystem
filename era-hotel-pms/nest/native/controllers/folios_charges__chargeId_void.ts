/** Lifted from era-hotel-pms/nest/generated/folios_charges__chargeId_void.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { voidCharge } from '@/lib/services/folio.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const bodySchema = z.object({
  reason: z.string().trim().min(1).max(500),
});


@Controller()
export class FoliosChargesChargeIdVoidController {
  @Post("api/folios/charges/:chargeId/void")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.FOLIO_VOID);
    const { chargeId } = httpReq.params;
    const body = bodySchema.parse(httpReq.body);
    const result = await voidCharge(chargeId, body.reason, {
      userId: session?.sub,
      request: { headers: { get: (name: string) => nestHeader(httpReq, name) } },
    });
    return sendJson(httpRes, serialize(result));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
