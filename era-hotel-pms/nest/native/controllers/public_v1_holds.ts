/** Lifted from era-hotel-pms/nest/generated/public_v1_holds.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, Options, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { createIbeHold, ibeCorsHeaders, ibeErrorStatus, ibePreflightHeaders, resolveIbeTenant } from '@/lib/channel/ibe.service';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { serialize } from '@/lib/serialize';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const bodySchema = z.object({
  roomTypeId: z.string().uuid(),
  ratePlanId: z.string().uuid(),
  from: z.string().min(8),
  nights: z.number().int().min(1).max(60),
  adults: z.number().int().min(1).max(12).optional(),
  children: z.number().int().min(0).max(12).optional(),
  ttlMinutes: z.number().int().min(5).max(60).optional(),
});

@Controller()
export class PublicV1HoldsController {
  @Options("api/public/v1/holds")
  @HttpCode(204)
  options_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const headers = ibePreflightHeaders(nestHeader(httpReq, "origin"));
    for (const [key, value] of Object.entries(headers)) httpRes.setHeader(key, String(value));
    httpRes.status(204).send();
  }

  @Post("api/public/v1/holds")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  try {
    const { origins, organizationId } = await resolveIbeTenant({ headers: { get: (name: string) => nestHeader(httpReq, name) } });
    await requireHotelModule('hotel_distribution', organizationId);
    const body = bodySchema.parse(httpReq.body);
    const hold = await createIbeHold(body);
    return sendJson(httpRes, serialize(hold), ( {
      status: 201,
      headers: ibeCorsHeaders(origins, nestHeader(httpReq, 'origin')),
    }).status ?? 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'IBE hold failed';
    return sendJson(httpRes, { error: message }, ( { status: ibeErrorStatus(err) }).status ?? 200);
  }

        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
