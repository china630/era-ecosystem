import { assertPermission } from '@/lib/auth/require';
import { sessionHasHotelPermission } from '@/lib/auth/permission-check';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { listReservationJournal } from '@/lib/reservation-audit';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/reservations/:id/journal", async (httpReq, httpRes) => {
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
    const { id } = httpReq.params;
    const url = new URL(request.url);
    const includeIp = Boolean(
      session && sessionHasHotelPermission(session, PERMISSIONS.SCREEN_SETTINGS),
    );
    const journal = await listReservationJournal(id, {
      includeIp,
      section: url.searchParams.get('section') ?? undefined,
      source: url.searchParams.get('source') ?? undefined,
    });
    return sendJson(httpRes, journal);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
