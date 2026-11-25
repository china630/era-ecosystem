/** Lifted from era-hotel-pms/nest/generated/reservations__id_schedule.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { updateReservationSchedule } from '@/lib/services/reservation.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const schema = z.object({
  checkInDate: z.coerce.date().optional(),
  checkOutDate: z.coerce.date().optional(),
  roomId: z.string().uuid().nullable().optional(),
});


@Controller()
export class ReservationsIdScheduleController {
  @Patch("api/reservations/:id/schedule")
  @HttpCode(200)
  async patch_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const { id } = httpReq.params;
    const body = schema.parse(httpReq.body);
    const { loadReservationAuditSnapshot, recordReservationDiff } = await import(
      '@/lib/reservation-audit'
    );
    const before = await loadReservationAuditSnapshot(id);
    const reservation = await updateReservationSchedule(id, body);
    const after = await loadReservationAuditSnapshot(id);
    await recordReservationDiff(id, 'UPDATE', before, after, {
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
