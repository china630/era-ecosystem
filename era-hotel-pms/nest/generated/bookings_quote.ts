import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { quoteReservationStay, resolveQuoteRoomTypeId } from '@/lib/services/pricing-quote.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const schema = z.object({
  ratePlanId: z.string().uuid(),
  checkInDate: z.coerce.date(),
  checkOutDate: z.coerce.date(),
  agencyId: z.string().uuid().optional(),
  roomTypeId: z.string().uuid().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/bookings/quote", async (httpReq, httpRes) => {
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

  
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    const params = new URL(request.url).searchParams;
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
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
