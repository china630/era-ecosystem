/** Lifted from era-hotel-pms/nest/generated/internal_v1_reservations_checked-out.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { listCheckedOutReservationIds } from '@/lib/services/reservation.service';
import { enterRequestTenant } from '@/lib/request-organization';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const bodySchema = z.object({
  organizationId: z.string().min(1),
  reservationIds: z.array(z.string().min(1)).max(200),
});

function assertServiceToken(request: Request): boolean {
  const expected = process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim();
  if (!expected) return false;
  const auth = request.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  return token === expected;
}

/** Which of these reservations are already CHECKED_OUT. Planned date is ignored. */


@Controller()
export class InternalV1ReservationsCheckedOutController {
  @Post("api/internal/v1/reservations/checked-out")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  if (!assertServiceToken({ headers: { get: (name: string) => nestHeader(httpReq, name) }, url: new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").toString() })) {
    return sendJson(httpRes, { error: 'Unauthorized' }, 401);
  }
  const body = bodySchema.parse(httpReq.body);
  enterRequestTenant(body.organizationId);
  const ids = await listCheckedOutReservationIds(body.reservationIds);
  return sendJson(httpRes, { ids });

        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
