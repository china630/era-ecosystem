/** Lifted from era-hotel-pms/nest/generated/reservations__id_extras.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { addQuickCharge, getReservation } from '@/lib/services/reservation.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const schema = z.object({
  revenueCodeId: z.string().uuid(),
  amount: z.number().positive(),
  qty: z.number().int().positive().optional(),
  description: z.string().min(1),
});


@Controller()
export class ReservationsIdExtrasController {
  @Post("api/reservations/:id/extras")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.FOLIO_CHARGE);
    const { id } = httpReq.params;
    const body = schema.parse(httpReq.body);
    const charge = await addQuickCharge(id, {
      ...body,
      audit: { userId: session?.sub, request: { headers: { get: (name: string) => nestHeader(httpReq, name) } } },
    });
    const reservation = await getReservation(id);
    return sendJson(httpRes, serialize({ charge, reservation }));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
