/** Lifted from era-hotel-pms/nest/generated/reservations__id_clinic-checkout.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getReservation } from '@/lib/services/reservation.service';
import { requestOrganizationId } from '@/lib/request-organization';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

/** Sanatorium checkout list. A non-medical rate returns medical:false and does not call the clinic. */


@Controller()
export class ReservationsIdClinicCheckoutController {
  @Get("api/reservations/:id/clinic-checkout")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.RESERVATIONS_CHECKOUT);
    const { id } = httpReq.params;
    const reservation = await getReservation(id);
    const { usesMedicalPackageCompose } = await import(
      '@/lib/services/medical-package-resolve.service'
    );
    if (!usesMedicalPackageCompose(reservation.ratePlan)) return sendJson(httpRes, { medical: false });

    const base = (
      process.env.CLINIC_URL ??
      process.env.ERA_CLINIC_URL ??
      ''
    ).replace(/\/$/, '');
    const token = process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim() ?? '';
    if (!base || !token) return sendJson(httpRes, { medical: true, unavailable: true, paid: [], packageSessions: [], blocksCheckout: false });

    const qs = new URLSearchParams({
      organizationId: requestOrganizationId(),
      reservationId: id,
    });
    const res = await fetch(`${base}/api/internal/v1/stay-procedures?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return sendJson(httpRes, { medical: true, unavailable: true, paid: [], packageSessions: [], blocksCheckout: false });
    }
    const body = (httpReq.body) as { data?: Record<string, unknown> };
    const data = body.data ?? body;
    return sendJson(httpRes, { medical: true, unavailable: false, ...data });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
