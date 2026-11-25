/** Lifted from era-hotel-pms/nest/generated/reservations__id_deposits_apply.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getFolioReservationId, moveHeldDepositsOntoFolio } from '@/lib/services/folio-deposit.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const bodySchema = z.object({
  folioId: z.string().uuid(),
  amount: z.number().positive(),
});


@Controller()
export class ReservationsIdDepositsApplyController {
  @Post("api/reservations/:id/deposits/apply")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.FOLIO_PAYMENT);
    const body = bodySchema.parse(httpReq.body);
    const reservationId = await getFolioReservationId(body.folioId);
    if (!reservationId) return sendJson(httpRes, { error: 'Folio not found' }, 404);
    const moved = await moveHeldDepositsOntoFolio(reservationId);
    if (moved <= 0) return sendJson(httpRes, { error: 'No held deposit to apply' }, 400);
    return sendJson(httpRes, serialize({ applied: moved }));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
