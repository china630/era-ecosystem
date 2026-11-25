/** Lifted from era-hotel-pms/nest/generated/reservations__id_deposits_settle.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { carryDepositRemainder, payoutDepositRemainder } from '@/lib/services/folio-deposit.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const bodySchema = z.object({
  depositId: z.string().uuid(),
  action: z.enum(['payout', 'carry']),
  paymentMethod: z.enum(['CASH', 'CARD']).optional(),
  bankTerminalId: z.string().min(1).max(64).optional(),
});


@Controller()
export class ReservationsIdDepositsSettleController {
  @Post("api/reservations/:id/deposits/settle")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.FOLIO_PAYMENT);
    const body = bodySchema.parse(httpReq.body);
    const audit = { userId: session?.sub, request: { headers: { get: (name: string) => nestHeader(httpReq, name) } } };
    if (body.action === 'carry') {
      return sendJson(httpRes, serialize(await carryDepositRemainder(body.depositId, audit)));
    }
    if (!body.paymentMethod) {
      throw new Error('Payout needs cash or card');
    }
    return sendJson(httpRes, 
      serialize(
        await payoutDepositRemainder(
          body.depositId,
          body.paymentMethod,
          body.bankTerminalId,
          audit,
        ),
      ),
    );
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
