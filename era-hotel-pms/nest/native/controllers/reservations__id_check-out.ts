/** Lifted from era-hotel-pms/nest/generated/reservations__id_check-out.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { checkoutReservation } from '@/lib/services/checkout.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const bodySchema = z
  .object({
    transferToCityLedger: z.boolean().optional(),
    moveGuestDebtToPayer: z.boolean().optional(),
    transferToGuestDebt: z.boolean().optional(),
    guestDebtNote: z.string().max(500).optional(),
    discountAmount: z.number().positive().optional(),
    discountDescription: z.string().max(200).optional(),
    unusedNightsRefundMethod: z.enum(['CASH', 'CARD']).optional(),
    unusedNightsBankTerminalId: z.string().min(1).max(64).optional(),
    unusedNightsReason: z.string().max(500).optional(),
    procedureCreditRefundMethod: z.enum(['CASH', 'CARD']).optional(),
    procedureCreditBankTerminalId: z.string().min(1).max(64).optional(),
    surplusAction: z.enum(['REFUND', 'CARRY']).optional(),
    surplusMethod: z.enum(['CASH', 'CARD']).optional(),
    surplusBankTerminalId: z.string().min(1).max(64).optional(),
    targetReservationId: z.string().uuid().optional(),
    newStayCheckIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    newStayCheckOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    transferOutDecisions: z
      .array(
        z.object({
          orderId: z.string().uuid(),
          action: z.enum(['SHIFT', 'KEEP', 'CANCEL', 'LEAVE']),
          pickupAt: z.string().datetime().optional(),
        }),
      )
      .optional(),
  })
  .optional();


@Controller()
export class ReservationsIdCheckOutController {
  @Post("api/reservations/:id/check-out")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.RESERVATIONS_CHECKOUT);
    const { id } = httpReq.params;
    const rawText = (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? ""));
    const parsed = rawText.trim() ? bodySchema.parse(JSON.parse(rawText)) : undefined;
    const result = await checkoutReservation(id, {
      ...(parsed ?? {}),
      createdByUserId: session?.sub,
      auditRequest: { headers: { get: (name: string) => nestHeader(httpReq, name) } },
    });
    return sendJson(httpRes, serialize(result));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
