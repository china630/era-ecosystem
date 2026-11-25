/** Lifted from era-hotel-pms/nest/generated/reservations__id_early-checkout-preview.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { previewEarlyCheckoutUnusedNights } from '@/lib/services/early-checkout-unused-nights.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class ReservationsIdEarlyCheckoutPreviewController {
  @Get("api/reservations/:id/early-checkout-preview")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.RESERVATIONS_CHECKOUT);
    const { id } = httpReq.params;
    const preview = await previewEarlyCheckoutUnusedNights(id);
    return sendJson(httpRes, preview);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
