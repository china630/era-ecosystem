/** Lifted from era-hotel-pms/nest/generated/reservations__id_cancel.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { cancelReservation } from '@/lib/services/reservation.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const schema = z.object({
  noShow: z.boolean().optional(),
  reason: z.string().trim().max(500).optional(),
});


@Controller()
export class ReservationsIdCancelController {
  @Patch("api/reservations/:id/cancel")
  @HttpCode(200)
  async patch_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.RESERVATIONS_CANCEL);
    const { id } = httpReq.params;
    const body = schema.parse((httpReq.body ?? {}));
    const reservation = await cancelReservation(id, body.noShow, body.reason, {
      userId: session?.sub,
      request: { headers: { get: (name: string) => nestHeader(httpReq, name) } },
    });
    return sendJson(httpRes, serialize(reservation));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
