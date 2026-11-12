import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { listReservationsForGrid } from '@/lib/services/reservation-full.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/reports/reservations-grid", async (httpReq, httpRes) => {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const req = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    const params = new URL(req.url).searchParams;
    const hasNotesRaw = params.get('hasNotes');
    const result = await listReservationsForGrid({
      guestId: params.get('guestId') ?? undefined,
      q: params.get('q') ?? undefined,
      noteQ: params.get('noteQ') ?? undefined,
      status: params.get('status') ?? undefined,
      hasNotes: hasNotesRaw === '1' || hasNotesRaw === 'true',
      page: params.get('page') ? Number(params.get('page')) : undefined,
      pageSize: params.get('pageSize') ? Number(params.get('pageSize')) : undefined,
      dateFrom: params.get('dateFrom') ?? undefined,
      dateTo: params.get('dateTo') ?? undefined,
      queue: params.get('queue') ?? undefined,
      overdue: params.get('overdue') === '1',
      sort: params.get('sort') ?? undefined,
      dir: params.get('dir') === 'desc' ? 'desc' : params.get('dir') === 'asc' ? 'asc' : undefined,
    });
    return sendJson(httpRes, serialize(result));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
