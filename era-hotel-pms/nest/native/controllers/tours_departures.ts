/** Lifted from era-hotel-pms/nest/generated/tours_departures.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { createTourDeparture, listTourDepartures } from '@/lib/services/tour.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const bodySchema = z.object({
  templateId: z.string().uuid().optional(),
  date: z.string(),
  pickupAt: z.string().datetime(),
  returnAt: z.string().datetime(),
  agenda: z.string().optional(),
  meetingPoint: z.string().optional(),
  guideName: z.string().optional(),
  vehicleId: z.string().uuid().optional(),
  capacity: z.number().int().positive().optional(),
  price: z.number().nonnegative().optional(),
});


@Controller()
export class ToursDeparturesController {
  @Get("api/tours/departures")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.TOURS_WRITE);
    await requireHotelModule('hotel_transfers', session.organizationId);
    const url = requestUrl;
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const status = url.searchParams.get('status') ?? undefined;
    return sendJson(httpRes, 
      serialize(
        await listTourDepartures({
          from: from ? new Date(from) : undefined,
          to: to ? new Date(to) : undefined,
          status,
        }),
      ),
    );
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/tours/departures")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.TOURS_WRITE);
    await requireHotelModule('hotel_transfers', session.organizationId);
    const body = bodySchema.parse(httpReq.body);
    return sendJson(httpRes, 
      serialize(
        await createTourDeparture({
          ...body,
          date: new Date(body.date),
          pickupAt: new Date(body.pickupAt),
          returnAt: new Date(body.returnAt),
        }),
      ),
      201,
    );
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
