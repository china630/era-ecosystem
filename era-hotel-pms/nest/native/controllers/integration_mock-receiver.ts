/** Lifted from era-hotel-pms/nest/generated/integration_mock-receiver.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";

import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const KNOWN_EVENTS = [
  'SATELLITE_HOTEL_RESERVATION_COMPLETED',
  'SATELLITE_HOTEL_NIGHT_AUDIT_CLOSED',
  'SATELLITE_HOTEL_FOLIO_CHARGE_POSTED',
  'SATELLITE_HOTEL_FOLIO_PAYMENT_RECEIVED',
  'SATELLITE_HOTEL_FOLIO_CHARGE_VOIDED',
] as const;


@Controller()
export class IntegrationMockReceiverController {
  @Post("api/integration/mock-receiver")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  if (process.env.NODE_ENV === 'production') {
    return sendJson(httpRes, { error: 'Not available in production' }, 404);
  }
  const body = (httpReq.body) as { eventType?: string; correlationId?: string };
  const eventType = body.eventType ?? 'UNKNOWN';
  const known = KNOWN_EVENTS.includes(eventType as (typeof KNOWN_EVENTS)[number]);
  console.log(
    `[mock-receiver] ${eventType} correlation=${body.correlationId ?? '—'}`,
    JSON.stringify(body, null, 2),
  );
  return sendJson(httpRes, {
    received: true,
    known,
    eventType,
    at: new Date().toISOString(),
  });

        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
