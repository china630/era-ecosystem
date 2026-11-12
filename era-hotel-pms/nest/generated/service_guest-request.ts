import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRequest, findRoomIdByNumber } from '@/lib/services/service-work-order.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  roomNumber: z.string().max(16).optional(),
  token: z.string().optional(),
});

/** Public guest service request (QR in room). Optional SERVICE_GUEST_TOKEN env. */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/service/guest-request", async (httpReq, httpRes) => {
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

  
    const expected = process.env.SERVICE_GUEST_TOKEN?.trim();
    const body = bodySchema.parse(httpReq.body);
    if (expected && body.token !== expected) {
      return sendJson(httpRes, { error: 'Invalid token' }, 401);
    }

    const roomId = body.roomNumber ? await findRoomIdByNumber(body.roomNumber) : undefined;

    const row = await createServiceRequest({
      title: body.title,
      description: body.description,
      source: 'GUEST',
      roomId,
      location: body.roomNumber ? `Room ${body.roomNumber}` : undefined,
      reportedBy: 'guest-portal',
      category: 'guest_request',
      priority: 'NORMAL',
    });
    return sendJson(httpRes, { ok: true, id: row.id }, 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
