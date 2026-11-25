/** Lifted from era-hotel-pms/nest/generated/folios_category-refund.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { PAYMENT_CATEGORIES } from '@/lib/payment-category';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const schema = z.object({
  reservationId: z.string().uuid(),
  paymentCategory: z.enum(PAYMENT_CATEGORIES),
  amount: z.number().positive(),
  reason: z.string().trim().min(1).max(500),
  paymentMethod: z.enum(['CASH', 'CARD']).optional(),
  bankTerminalId: z.string().min(1).max(64).optional(),
  folioType: z.enum(['GUEST', 'AGENCY', 'COMPANY']).optional(),
  reservationGuestId: z.string().uuid().optional(),
});

/** Mid-stay return of unused credit in one cashier category on one pocket. */


@Controller()
export class FoliosCategoryRefundController {
  @Post("api/folios/category-refund")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.FOLIO_PAYMENT);
    const body = schema.parse(httpReq.body);
    const { refundStayCategoryCredit } = await import('@/lib/services/booking-folio.service');
    const rows = await refundStayCategoryCredit({
      reservationId: body.reservationId,
      paymentCategory: body.paymentCategory,
      amount: body.amount,
      reason: body.reason,
      paymentMethod: body.paymentMethod,
      bankTerminalId: body.bankTerminalId,
      folioType: body.folioType,
      reservationGuestId: body.reservationGuestId,
      createdByUserId: session?.sub,
      auditRequest: { headers: { get: (name: string) => nestHeader(httpReq, name) } },
    });
    return sendJson(httpRes, serialize(rows), 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
