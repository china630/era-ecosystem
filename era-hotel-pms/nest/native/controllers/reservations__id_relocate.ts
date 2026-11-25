/** Lifted from era-hotel-pms/nest/generated/reservations__id_relocate.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { isClassSettlement, requestRoomMove } from '@/lib/services/room-move-request.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const schema = z.object({
  roomId: z.string().uuid(),
  reason: z.string().optional(),
  reasonCode: z.string().optional(),
  compUpgrade: z.boolean().optional(),
  givenRoomTypeId: z.string().uuid().nullable().optional(),
  settlement: z.enum(['HOTEL', 'GUEST_PAY', 'HOTEL_REFUND', 'GUEST_CHEAPER']).optional(),
  effectiveDate: z.string().optional(),
});


@Controller()
export class ReservationsIdRelocateController {
  @Post("api/reservations/:id/relocate")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const { id } = httpReq.params;
    const body = schema.parse(httpReq.body);
    const settlement = body.settlement ?? (body.compUpgrade ? 'HOTEL' : undefined);
    const result = await requestRoomMove(id, body.roomId, {
      effectiveDate: body.effectiveDate,
      reasonCode: body.reasonCode ?? body.reason,
      settlement: isClassSettlement(settlement) ? settlement : null,
      actorUserId: session?.sub,
      request: { headers: { get: (name: string) => nestHeader(httpReq, name) } },
    });
    return sendJson(httpRes, result);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
