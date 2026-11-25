/** Lifted from era-hotel-pms/nest/generated/banquets__id_resources.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { addEventResourceBooking, deleteEventResourceBooking } from '@/lib/services/event-order.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const createSchema = z.object({
  saloonId: z.string().uuid().optional(),
  posResourceId: z.string().uuid().optional(),
  label: z.string().optional(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  notes: z.string().optional(),
});


@Controller()
export class BanquetsIdResourcesController {
  @Post("api/banquets/:id/resources")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.BANQUETS_WRITE);
    await requireHotelModule('hotel_banquets', session.organizationId);
    const { id } = httpReq.params;
    const body = createSchema.parse(httpReq.body);
    return sendJson(httpRes, 
      serialize(await addEventResourceBooking({ ...body, banquetEventId: id })),
      201,
    );
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Delete("api/banquets/:id/resources")
  @HttpCode(200)
  async delete_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.BANQUETS_WRITE);
    await requireHotelModule('hotel_banquets', session.organizationId);
    const url = requestUrl;
    const bookingId = url.searchParams.get('bookingId');
    if (!bookingId) throw new Error('bookingId query param required');
    await deleteEventResourceBooking(bookingId);
    return sendJson(httpRes, { deleted: true });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
