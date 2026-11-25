/** Lifted from era-hotel-pms/nest/generated/tours_bookings__id.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { removeTourBooking } from '@/lib/services/tour.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const cancelSchema = z.object({
  reason: z.string().optional(),
});


@Controller()
export class ToursBookingsIdController {
  @Delete("api/tours/bookings/:id")
  @HttpCode(200)
  async delete_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.TOURS_WRITE);
    await requireHotelModule('hotel_transfers', session.organizationId);
    const { id } = httpReq.params;
    let reason: string | undefined;
    try {
      const body = cancelSchema.parse(httpReq.body);
      reason = body.reason;
    } catch {
      reason = undefined;
    }
    return sendJson(httpRes, serialize(await removeTourBooking(id, reason)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
