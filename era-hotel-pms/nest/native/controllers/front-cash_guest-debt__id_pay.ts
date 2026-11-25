/** Lifted from era-hotel-pms/nest/generated/front-cash_guest-debt__id_pay.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { payGuestDebt } from '@/lib/services/folio.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const schema = z.object({
  amount: z.number().positive(),
  paymentMethod: z.enum(['CASH', 'CARD', 'BANK_TRANSFER']),
  bankTerminalId: z.string().uuid().optional().nullable(),
});


@Controller()
export class FrontCashGuestDebtIdPayController {
  @Post("api/front-cash/guest-debt/:id/pay")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.FOLIO_PAYMENT);
    const { id } = httpReq.params;
    const body = schema.parse(httpReq.body);
    return sendJson(httpRes, 
      serialize(
        await payGuestDebt({
          entryId: id,
          amount: body.amount,
          paymentMethod: body.paymentMethod,
          bankTerminalId: body.bankTerminalId,
          createdByUserId: session?.sub,
          auditRequest: { headers: { get: (name: string) => nestHeader(httpReq, name) } },
        }),
      ),
    );
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
