import { NextResponse } from 'next/server';
import { z } from 'zod';
import { bookIbe, ibeCorsHeaders, ibeErrorStatus, ibePreflightHeaders, resolveIbeTenant } from '@/lib/channel/ibe.service';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { serialize } from '@/lib/serialize';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

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

export async function OPTIONS(req: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: ibePreflightHeaders(req.headers.get('origin')),
  });
}

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/public/v1/bookings", async (httpReq, httpRes) => {
    try {
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const req = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  try {
    const { origins, organizationId } = await resolveIbeTenant(req);
    await requireHotelModule('hotel_distribution', organizationId);
    const body = bodySchema.parse(httpReq.body);
    const idempotencyKey =
      req.headers.get('idempotency-key')?.trim() ||
      `auto-${body.roomTypeId}-${body.from}-${body.guestName}`.slice(0, 120);
    const result = await bookIbe({ ...body, idempotencyKey });
    const status = result.idempotent ? 200 : 201;
    return sendJson(httpRes, 
      { ...serialize(result.reservation), idempotent: result.idempotent }, (
      {
        status,
        headers: ibeCorsHeaders(origins, req.headers.get('origin')),
      }).status ?? 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'IBE book failed';
    return sendJson(httpRes, { error: message }, ( { status: ibeErrorStatus(err) }).status ?? 200);
  }

        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
