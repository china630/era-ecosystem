/** Lifted from era-hotel-pms/nest/generated/bookings_quote.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { quoteReservationStay, resolveQuoteRoomTypeId } from '@/lib/services/pricing-quote.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const schema = z.object({
  ratePlanId: z.string().uuid(),
  checkInDate: z.coerce.date(),
  checkOutDate: z.coerce.date(),
  agencyId: z.string().uuid().optional(),
  roomTypeId: z.string().uuid().optional(),
});


@Controller()
export class BookingsQuoteController {
  @Get("api/bookings/quote")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    const params = requestUrl.searchParams;
    const body = schema.parse({
      ratePlanId: params.get('ratePlanId'),
      checkInDate: params.get('checkInDate'),
      checkOutDate: params.get('checkOutDate'),
      agencyId: params.get('agencyId') ?? undefined,
      roomTypeId: params.get('roomTypeId') ?? undefined,
    });
    const roomTypeId = await resolveQuoteRoomTypeId(body.ratePlanId, body.roomTypeId);
    return sendJson(httpRes, 
      serialize(
        await quoteReservationStay({
          ...body,
          roomTypeId,
        }),
      ),
    );
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
