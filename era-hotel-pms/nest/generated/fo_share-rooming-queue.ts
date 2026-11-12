import { serialize } from '@/lib/serialize';
import { listShareRoomingQueue } from '@/lib/services/share-assignment.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

/** FIFO unassigned share-eligible stays for union rooming. */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/fo/share-rooming-queue", async (httpReq, httpRes) => {
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
    const roomTypeId = url.searchParams.get('roomTypeId') ?? undefined;
    const gender = url.searchParams.get('gender') as 'M' | 'F' | null;
    const limit = url.searchParams.get('limit');
    const rows = await listShareRoomingQueue({
      roomTypeId,
      gender: gender === 'M' || gender === 'F' ? gender : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    return sendJson(httpRes, serialize(rows));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
