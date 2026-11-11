import { serialize } from '@/lib/serialize';
import { swapReservationRooms } from '@/lib/services/swap-rooms.service';
import { isClassSettlement } from '@/lib/room-move-settlement';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/reservations/:id/swap-room", async (httpReq, httpRes) => {
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

  try {
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const { id } = httpReq.params;
    const body = (httpReq.body) as {
      otherReservationId?: string;
      settlementA?: string;
      settlementB?: string;
    };
    if (!body.otherReservationId) {
      return sendJson(httpRes, { error: 'otherReservationId is required' }, 400);
    }
    const result = await swapReservationRooms(id, body.otherReservationId, {
      actorUserId: session?.sub,
      request,
      settlementA: isClassSettlement(body.settlementA) ? body.settlementA : null,
      settlementB: isClassSettlement(body.settlementB) ? body.settlementB : null,
    });
    return sendJson(httpRes, serialize(result));
  } catch (err) {
    const status = (err as Error & { status?: number }).status;
    if (status === 409) {
      return sendJson(httpRes, { error: err instanceof Error ? err.message : 'Conflict' }, 409);
    }
    return sendRouteError(httpRes, err);
  }

        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
