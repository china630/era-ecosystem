/** Lifted from era-hotel-pms/nest/generated/reservations__id.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { deleteEmptyReservation } from '@/lib/services/delete-reservation.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const schema = z.object({
  reason: z.string().trim().min(1).max(500),
});


@Controller()
export class ReservationsIdController {
  @Delete("api/reservations/:id")
  @HttpCode(200)
  async delete_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.RESERVATIONS_CANCEL);
    const { id } = httpReq.params;
    const body = schema.parse((httpReq.body ?? {}));
    return sendJson(httpRes, serialize(await deleteEmptyReservation(id, body.reason, { userId: session?.sub, request: { headers: { get: (name: string) => nestHeader(httpReq, name) } } })));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
