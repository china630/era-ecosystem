/** Lifted from era-hotel-pms/nest/generated/public_booking_rates.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

/**
 * Legacy B2C rates dump — not org-scoped.
 * Prefer GET /api/public/v1/availability with IBE publishable key.
 */


@Controller()
export class PublicBookingRatesController {
  @Get("api/public/booking/rates")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  return sendJson(httpRes, 
    {
      error: 'GONE',
      message:
        'Use GET /api/public/v1/availability with Authorization: Bearer <ibePublishableKey>',
      widget: 'b2c_v2_bar',
    }, 410);

        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
