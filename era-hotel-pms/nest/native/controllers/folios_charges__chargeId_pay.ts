/** Lifted from era-hotel-pms/nest/generated/folios_charges__chargeId_pay.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { payFolioCharge } from '@/lib/services/tour.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const bodySchema = z.object({
  paymentMethod: z.string().min(1).max(64),
  bankTerminalId: z.string().min(1).max(64).optional(),
});


@Controller()
export class FoliosChargesChargeIdPayController {
  @Post("api/folios/charges/:chargeId/pay")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.FOLIO_PAYMENT);
    await requireHotelModule('hotel_core', session.organizationId);
    const { chargeId } = httpReq.params;
    const body = bodySchema.parse(httpReq.body);
    if (body.paymentMethod === 'DEPOSIT') {
      return sendJson(httpRes, { error: 'DEPOSIT_INTAKE_CLOSED' }, 400);
    }
    return sendJson(httpRes, 
      serialize(
        await payFolioCharge(chargeId, body.paymentMethod, body.bankTerminalId, session.sub, req),
      ),
    );
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
