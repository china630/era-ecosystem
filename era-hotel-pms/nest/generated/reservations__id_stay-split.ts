import { z } from 'zod';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { splitStayFromDate } from '@/lib/services/stay-slice.service';
import { isClassSettlement, requestRoomMove } from '@/lib/services/room-move-request.service';
import { getReservationFull } from '@/lib/services/reservation-full.service';
import { serialize } from '@/lib/serialize';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const schema = z.object({
  fromDate: z.string().min(8),
  roomTypeId: z.string().uuid(),
  roomId: z.string().uuid().nullable().optional(),
  settlement: z.enum(['HOTEL', 'GUEST_PAY', 'HOTEL_REFUND', 'GUEST_CHEAPER']).optional(),
  reasonCode: z.string().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/reservations/:id/stay-split", async (httpReq, httpRes) => {
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

  
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const { id } = httpReq.params;
    const body = schema.parse(httpReq.body);
    if (body.roomId) {
      const result = await requestRoomMove(id, body.roomId, {
        effectiveDate: body.fromDate.slice(0, 10),
        settlement: isClassSettlement(body.settlement) ? body.settlement : null,
        reasonCode: body.reasonCode,
        actorUserId: session?.sub,
        request,
      });
      return sendJson(httpRes, serialize({ ...(await getReservationFull(id)), movePending: result.pending }));
    }
    await splitStayFromDate({
      reservationId: id,
      fromDate: new Date(`${body.fromDate.slice(0, 10)}T12:00:00.000Z`),
      roomTypeId: body.roomTypeId,
      roomId: null,
      actorUserId: session?.sub,
    });
    return sendJson(httpRes, serialize(await getReservationFull(id)));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
