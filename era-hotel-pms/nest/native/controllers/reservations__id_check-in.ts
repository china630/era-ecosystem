/** Lifted from era-hotel-pms/nest/generated/reservations__id_check-in.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { checkInReservation } from '@/lib/services/reservation.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const bodySchema = z
  .object({ early: z.boolean().optional(), checkInTime: z.string().optional() })
  .optional();


@Controller()
export class ReservationsIdCheckInController {
  @Post("api/reservations/:id/check-in")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.RESERVATIONS_CHECKIN);
    const { id } = httpReq.params;
    const raw = (httpReq.body ?? {});
    const body = bodySchema.parse(raw ?? {});
    const reservation = await checkInReservation(id, {
      early: body?.early === true,
      checkInTime: body?.checkInTime,
      audit: { userId: session?.sub, request: { headers: { get: (name: string) => nestHeader(httpReq, name) } } },
    });
    let guestQrToken: string | null = null;
    const { usesMedicalPackageCompose } = await import(
      '@/lib/services/medical-package-resolve.service'
    );
    if (
      usesMedicalPackageCompose(reservation.ratePlan) &&
      reservation.guest?.globalPersonId
    ) {
      try {
        const { issueGuestQrToken } = await import('@era/satellite-kit');
        const qr = await issueGuestQrToken(reservation.guest.globalPersonId);
        guestQrToken = qr?.token ?? null;
      } catch {
        guestQrToken = null;
      }
    }
    return sendJson(httpRes, { ...serialize(reservation), guestQrToken });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
