import { z } from 'zod';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { isClassSettlement, requestRoomMove } from '@/lib/services/room-move-request.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const schema = z.object({
  roomId: z.string().uuid(),
  reason: z.string().optional(),
  reasonCode: z.string().optional(),
  compUpgrade: z.boolean().optional(),
  givenRoomTypeId: z.string().uuid().nullable().optional(),
  settlement: z.enum(['HOTEL', 'GUEST_PAY', 'HOTEL_REFUND', 'GUEST_CHEAPER']).optional(),
  effectiveDate: z.string().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/reservations/:id/relocate", async (httpReq, httpRes) => {
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
    const settlement = body.settlement ?? (body.compUpgrade ? 'HOTEL' : undefined);
    const result = await requestRoomMove(id, body.roomId, {
      effectiveDate: body.effectiveDate,
      reasonCode: body.reasonCode ?? body.reason,
      settlement: isClassSettlement(settlement) ? settlement : null,
      actorUserId: session?.sub,
      request,
    });
    return sendJson(httpRes, result);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
