/** Lifted from era-hotel-pms/nest/generated/settlement_pending_basket_pay.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { payPendingBasket } from '@/lib/services/settlement-hub.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const schema = z.object({
  basketRef: z.string().min(1).max(64),
  paymentMethod: z.enum(['CASH', 'CARD']),
});


@Controller()
export class SettlementPendingBasketPayController {
  @Post("api/settlement/pending/basket/pay")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.FOLIO_PAYMENT);
    const body = schema.parse(httpReq.body);
    const paid = await payPendingBasket(body);
    return sendJson(httpRes, paid);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
