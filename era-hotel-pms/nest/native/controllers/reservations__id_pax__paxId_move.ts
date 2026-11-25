/** Lifted from era-hotel-pms/nest/generated/reservations__id_pax__paxId_move.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { serialize } from '@/lib/serialize';
import { moveGuestBetweenStays } from '@/lib/services/move-guest.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class ReservationsIdPaxPaxIdMoveController {
  @Post("api/reservations/:id/pax/:paxId/move")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  try {
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const { id, paxId } = httpReq.params;
    const body = (httpReq.body) as {
      toReservationId?: string;
      effectiveDate?: string;
    };
    if (!body.toReservationId) {
      return sendJson(httpRes, { error: 'toReservationId is required' }, 400);
    }
    const result = await moveGuestBetweenStays(id, paxId, body.toReservationId, {
      effectiveDate: body.effectiveDate ? new Date(body.effectiveDate) : undefined,
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
