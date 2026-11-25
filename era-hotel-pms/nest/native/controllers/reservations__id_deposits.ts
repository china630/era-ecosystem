/** Lifted from era-hotel-pms/nest/generated/reservations__id_deposits.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { listDeposits, recordDeposit } from '@/lib/services/folio-deposit.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const bodySchema = z.object({
  reservationGuestId: z.string().uuid(),
  amount: z.number().positive(),
  paymentMethod: z.enum(['CASH', 'CARD']),
  bankTerminalId: z.string().min(1).max(64).optional(),
});


@Controller()
export class ReservationsIdDepositsController {
  @Get("api/reservations/:id/deposits")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.FOLIO_READ);
    const { id } = httpReq.params;
    return sendJson(httpRes, serialize(await listDeposits(id)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/reservations/:id/deposits")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.FOLIO_PAYMENT);
    const { id } = httpReq.params;
    const data = bodySchema.parse(httpReq.body);
    const row = await recordDeposit({
      reservationId: id,
      reservationGuestId: data.reservationGuestId,
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      bankTerminalId: data.bankTerminalId,
      audit: { userId: session?.sub, request: { headers: { get: (name: string) => nestHeader(httpReq, name) } } },
    });
    return sendJson(httpRes, serialize(row), 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
