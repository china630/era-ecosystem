/** Lifted from era-hotel-pms/nest/generated/tours_departures__id.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { getTourDeparture, updateTourDeparture } from '@/lib/services/tour.service';
import type { TourDepartureStatus } from '@prisma/client';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const patchSchema = z.object({
  agenda: z.string().optional(),
  meetingPoint: z.string().optional(),
  guideName: z.string().nullable().optional(),
  vehicleId: z.string().uuid().nullable().optional(),
  pickupAt: z.string().datetime().optional(),
  returnAt: z.string().datetime().optional(),
  capacity: z.number().int().positive().optional(),
  price: z.number().nonnegative().optional(),
  status: z.enum(['DRAFT', 'OPEN', 'CLOSED', 'DEPARTED', 'CANCELLED']).optional(),
});


@Controller()
export class ToursDeparturesIdController {
  @Get("api/tours/departures/:id")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.TOURS_WRITE);
    await requireHotelModule('hotel_transfers', session.organizationId);
    const { id } = httpReq.params;
    return sendJson(httpRes, serialize(await getTourDeparture(id)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Patch("api/tours/departures/:id")
  @HttpCode(200)
  async patch_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.TOURS_WRITE);
    await requireHotelModule('hotel_transfers', session.organizationId);
    const { id } = httpReq.params;
    const body = patchSchema.parse(httpReq.body);
    return sendJson(httpRes, 
      serialize(
        await updateTourDeparture(id, {
          ...body,
          pickupAt: body.pickupAt ? new Date(body.pickupAt) : undefined,
          returnAt: body.returnAt ? new Date(body.returnAt) : undefined,
          status: body.status as TourDepartureStatus | undefined,
        }),
      ),
    );
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
