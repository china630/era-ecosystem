import { bakuDayBounds, todayBakuYmd } from '@era/satellite-kit/time';
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { createPosReservation, listPosReservations } from '@/lib/services/pos.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

/** @deprecated Table reservations UI lives in era-fnb-pos. */








const schema = z.object({
  resourceId: z.string().uuid(),
  startAt: z.string(),
  endAt: z.string(),
  partySize: z.number().int().optional(),
  reservationId: z.string().uuid().optional(),
  guestName: z.string().optional(),
  notes: z.string().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/pos/reservations", async (httpReq, httpRes) => {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    assertPermission(session, PERMISSIONS.POS_READ);
    const url = new URL(request.url);
    const dateStr = url.searchParams.get('date') ?? todayBakuYmd();
    const { start, end } = bakuDayBounds(dateStr);
    return sendJson(httpRes, serialize(await listPosReservations(start, end)));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/pos/reservations", async (httpReq, httpRes) => {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    assertPermission(session, PERMISSIONS.POS_WRITE);
    const body = schema.parse(httpReq.body);
    const row = await createPosReservation({
      resourceId: body.resourceId,
      startAt: new Date(body.startAt),
      endAt: new Date(body.endAt),
      partySize: body.partySize,
      reservationId: body.reservationId,
      guestName: body.guestName,
      notes: body.notes,
    });
    return sendJson(httpRes, serialize(row), 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
