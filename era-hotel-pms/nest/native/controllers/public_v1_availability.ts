/** Lifted from era-hotel-pms/nest/generated/public_v1_availability.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, Options, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { IbeAuthError, IbeForbiddenError, ibeCorsHeaders, ibeErrorStatus, ibePreflightHeaders, resolveIbeTenant, searchIbeAvailability } from '@/lib/channel/ibe.service';
import { todayBakuYmd } from '@era/satellite-kit/time';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

@Controller()
export class PublicV1AvailabilityController {
  @Options("api/public/v1/availability")
  @HttpCode(204)
  options_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const headers = ibePreflightHeaders(nestHeader(httpReq, "origin"));
    for (const [key, value] of Object.entries(headers)) httpRes.setHeader(key, String(value));
    httpRes.status(204).send();
  }

  @Get("api/public/v1/availability")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  try {
    const { origins, organizationId } = await resolveIbeTenant({ headers: { get: (name: string) => nestHeader(httpReq, name) } });
    await requireHotelModule('hotel_distribution', organizationId);
    const url = requestUrl;
    const from = url.searchParams.get('from') ?? todayBakuYmd();
    const nights = Number(url.searchParams.get('nights') ?? '1');
    const adults = Number(url.searchParams.get('adults') ?? '1');
    const children = Number(url.searchParams.get('children') ?? '0');
    const result = await searchIbeAvailability({ from, nights, adults, children });
    return sendJson(httpRes, result, ( {
      headers: ibeCorsHeaders(origins, nestHeader(httpReq, 'origin')),
    }).status ?? 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'IBE availability failed';
    return sendJson(httpRes, { error: message }, ( { status: ibeErrorStatus(err) }).status ?? 200);
  }

        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
