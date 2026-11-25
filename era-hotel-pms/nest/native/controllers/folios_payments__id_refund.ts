/** Lifted from era-hotel-pms/nest/generated/folios_payments__id_refund.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { refundFolioPayment } from '@/lib/services/folio-refund.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const schema = z.object({
  amount: z.number().positive().optional(),
  reason: z.string().trim().min(1).max(500),
  paymentMethod: z.enum(['CASH', 'CARD']).optional(),
  bankTerminalId: z.string().min(1).max(64).optional(),
});


@Controller()
export class FoliosPaymentsIdRefundController {
  @Post("api/folios/payments/:id/refund")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.FOLIO_PAYMENT);
    const { id } = httpReq.params;
    const body = schema.parse(httpReq.body);
    const payment = await refundFolioPayment({
      paymentId: id,
      amount: body.amount,
      reason: body.reason,
      paymentMethod: body.paymentMethod,
      bankTerminalId: body.bankTerminalId,
      createdByUserId: session?.sub,
      auditRequest: { headers: { get: (name: string) => nestHeader(httpReq, name) } },
    });
    return sendJson(httpRes, serialize(payment), 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
