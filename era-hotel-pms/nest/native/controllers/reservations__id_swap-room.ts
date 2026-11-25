/** Lifted from era-hotel-pms/nest/generated/reservations__id_swap-room.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { serialize } from '@/lib/serialize';
import { swapReservationRooms } from '@/lib/services/swap-rooms.service';
import { isClassSettlement } from '@/lib/room-move-settlement';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class ReservationsIdSwapRoomController {
  @Post("api/reservations/:id/swap-room")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  try {
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const { id } = httpReq.params;
    const body = (httpReq.body) as {
      otherReservationId?: string;
      settlementA?: string;
      settlementB?: string;
    };
    if (!body.otherReservationId) {
      return sendJson(httpRes, { error: 'otherReservationId is required' }, 400);
    }
    const result = await swapReservationRooms(id, body.otherReservationId, {
      actorUserId: session?.sub,
      request: { headers: { get: (name: string) => nestHeader(httpReq, name) } },
      settlementA: isClassSettlement(body.settlementA) ? body.settlementA : null,
      settlementB: isClassSettlement(body.settlementB) ? body.settlementB : null,
    });
    return sendJson(httpRes, serialize(result));
  } catch (err) {
    const status = (err as Error & { status?: number }).status;
    if (status === 409) {
      return sendJson(httpRes, { error: err instanceof Error ? err.message : 'Conflict' }, 409);
    }
    return sendRouteError(httpRes, err);
  }

      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
