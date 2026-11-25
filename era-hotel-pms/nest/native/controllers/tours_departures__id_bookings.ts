/** Lifted from era-hotel-pms/nest/generated/tours_departures__id_bookings.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { addTourBooking } from '@/lib/services/tour.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const bodySchema = z.object({
  reservationId: z.string().uuid(),
  notes: z.string().optional(),
});


@Controller()
export class ToursDeparturesIdBookingsController {
  @Post("api/tours/departures/:id/bookings")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.TOURS_WRITE);
    await requireHotelModule('hotel_transfers', session.organizationId);
    const { id } = httpReq.params;
    const body = bodySchema.parse(httpReq.body);
    return sendJson(httpRes, serialize(await addTourBooking({ departureId: id, ...body })), 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
