import { serialize } from '@/lib/serialize';
import { moveGuestBetweenStays } from '@/lib/services/move-guest.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/reservations/:id/pax/:paxId/move", async (httpReq, httpRes) => {
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
    const { id, paxId } = httpReq.params;
    const body = (httpReq.body) as {
      toReservationId?: string;
      effectiveDate?: string;
    };
    if (!body.toReservationId) {
      return sendJson(httpRes, { error: 'toReservationId is required' }, 400);
    }
    const result = await moveGuestBetweenStays(id, paxId, body.toReservationId, {
      effectiveDate: body.effectiveDate ? new Date(body.effectiveDate) : undefined,
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
