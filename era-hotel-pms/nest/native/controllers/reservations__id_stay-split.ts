/** Lifted from era-hotel-pms/nest/generated/reservations__id_stay-split.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { splitStayFromDate } from '@/lib/services/stay-slice.service';
import { isClassSettlement, requestRoomMove } from '@/lib/services/room-move-request.service';
import { getReservationFull } from '@/lib/services/reservation-full.service';
import { serialize } from '@/lib/serialize';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const schema = z.object({
  fromDate: z.string().min(8),
  roomTypeId: z.string().uuid(),
  roomId: z.string().uuid().nullable().optional(),
  settlement: z.enum(['HOTEL', 'GUEST_PAY', 'HOTEL_REFUND', 'GUEST_CHEAPER']).optional(),
  reasonCode: z.string().optional(),
});


@Controller()
export class ReservationsIdStaySplitController {
  @Post("api/reservations/:id/stay-split")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const { id } = httpReq.params;
    const body = schema.parse(httpReq.body);
    if (body.roomId) {
      const result = await requestRoomMove(id, body.roomId, {
        effectiveDate: body.fromDate.slice(0, 10),
        settlement: isClassSettlement(body.settlement) ? body.settlement : null,
        reasonCode: body.reasonCode,
        actorUserId: session?.sub,
        request: { headers: { get: (name: string) => nestHeader(httpReq, name) } },
      });
      return sendJson(httpRes, serialize({ ...(await getReservationFull(id)), movePending: result.pending }));
    }
    await splitStayFromDate({
      reservationId: id,
      fromDate: new Date(`${body.fromDate.slice(0, 10)}T12:00:00.000Z`),
      roomTypeId: body.roomTypeId,
      roomId: null,
      actorUserId: session?.sub,
    });
    return sendJson(httpRes, serialize(await getReservationFull(id)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
