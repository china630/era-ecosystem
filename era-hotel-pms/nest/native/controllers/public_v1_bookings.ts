/** Lifted from era-hotel-pms/nest/generated/public_v1_bookings.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, Options, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { bookIbe, ibeCorsHeaders, ibeErrorStatus, ibePreflightHeaders, resolveIbeTenant } from '@/lib/channel/ibe.service';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { serialize } from '@/lib/serialize';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const bodySchema = z.object({
  holdId: z.string().uuid().optional(),
  roomTypeId: z.string().uuid(),
  ratePlanId: z.string().uuid(),
  from: z.string().min(8),
  nights: z.number().int().min(1).max(60),
  adults: z.number().int().min(1).max(12).optional(),
  children: z.number().int().min(0).max(12).optional(),
  guestName: z.string().min(1),
  guestEmail: z.string().email().optional(),
  guestPhone: z.string().optional(),
  paymentMethod: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'COMPANY_ACCOUNT']).optional(),
});

@Controller()
export class PublicV1BookingsController {
  @Options("api/public/v1/bookings")
  @HttpCode(204)
  options_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const headers = ibePreflightHeaders(nestHeader(httpReq, "origin"));
    for (const [key, value] of Object.entries(headers)) httpRes.setHeader(key, String(value));
    httpRes.status(204).send();
  }

  @Post("api/public/v1/bookings")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  try {
    const { origins, organizationId } = await resolveIbeTenant({ headers: { get: (name: string) => nestHeader(httpReq, name) } });
    await requireHotelModule('hotel_distribution', organizationId);
    const body = bodySchema.parse(httpReq.body);
    const idempotencyKey =
      nestHeader(httpReq, 'idempotency-key')?.trim() ||
      `auto-${body.roomTypeId}-${body.from}-${body.guestName}`.slice(0, 120);
    const result = await bookIbe({ ...body, idempotencyKey });
    const status = result.idempotent ? 200 : 201;
    return sendJson(httpRes, 
      { ...serialize(result.reservation), idempotent: result.idempotent }, (
      {
        status,
        headers: ibeCorsHeaders(origins, nestHeader(httpReq, 'origin')),
      }).status ?? 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'IBE book failed';
    return sendJson(httpRes, { error: message }, ( { status: ibeErrorStatus(err) }).status ?? 200);
  }

        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
