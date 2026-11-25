/** Lifted from era-hotel-pms/nest/generated/tours_bookings__id_pay.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { payTourBooking } from '@/lib/services/tour.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const bodySchema = z.object({
  paymentMethod: z.enum(['CASH', 'CARD', 'BANK_TRANSFER']),
  bankTerminalId: z.string().uuid().optional(),
});


@Controller()
export class ToursBookingsIdPayController {
  @Post("api/tours/bookings/:id/pay")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.FOLIO_PAYMENT);
    await requireHotelModule('hotel_transfers', session.organizationId);
    const { id } = httpReq.params;
    const body = bodySchema.parse(httpReq.body);
    return sendJson(httpRes, 
      serialize(
        await payTourBooking(id, body.paymentMethod, session.sub, req, body.bankTerminalId),
      ),
    );
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
