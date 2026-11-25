/** Lifted from era-hotel-pms/nest/generated/reservations__id_pax__paxId_clinic-admit.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { serialize } from '@/lib/serialize';
import { admitGuestToClinic, revokeGuestClinicAdmit } from '@/lib/services/clinic-admit.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class ReservationsIdPaxPaxIdClinicAdmitController {
  @Post("api/reservations/:id/pax/:paxId/clinic-admit")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  try {
    assertPermission(session, PERMISSIONS.RESERVATIONS_CHECKIN);
    const { id, paxId } = httpReq.params;
    const body = ((httpReq.body ?? {})) as { admit?: boolean };
    const result = body.admit === false
      ? await revokeGuestClinicAdmit(id, paxId)
      : await admitGuestToClinic(id, paxId);
    return sendJson(httpRes, serialize(result));
  } catch (err) {
    const status = (err as Error & { status?: number; code?: string }).status;
    const code = (err as { code?: string }).code;
    if (status === 404 || status === 409) {
      const message = err instanceof Error ? err.message : 'Conflict';
      if (code) return sendJson(httpRes, { error: message, code }, ( { status }).status ?? 200);
      return sendJson(httpRes, { error: message }, status);
    }
    return sendRouteError(httpRes, err);
  }

      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
