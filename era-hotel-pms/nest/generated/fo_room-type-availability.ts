import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { parseHotelNoon } from '@/lib/hotel-calendar';
import { getRoomTypeAvailabilityMatrix } from '@/lib/services/room-type-availability.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/fo/room-type-availability", async (httpReq, httpRes) => {
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
    const url = new URL(request.url);
    const fromStr = url.searchParams.get('from');
    const toStr = url.searchParams.get('to');
    if (!fromStr || !toStr) throw new Error('from and to query params required (YYYY-MM-DD)');
    const from = parseHotelNoon(fromStr);
    const to = parseHotelNoon(toStr);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new Error('Invalid from/to date');
    }
    const data = await getRoomTypeAvailabilityMatrix(from, to);
    return sendJson(httpRes, serialize(data));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
