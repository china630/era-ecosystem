import { serialize } from '@/lib/serialize';
import { getGuestEntitlements } from '@/lib/services/guest-entitlements.service';
import { assertPosBridgeOrPermission } from '@/lib/pos-bridge-auth';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/pms/guest-entitlements", async (httpReq, httpRes) => {
    try {
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    await assertPosBridgeOrPermission(request, PERMISSIONS.RESERVATIONS_READ);
    const params = new URL(request.url).searchParams;
    const entitlements = await getGuestEntitlements({
      roomNumber: params.get('roomNumber') ?? undefined,
      reservationId: params.get('reservationId') ?? undefined,
    });
    if (!entitlements) {
      return sendJson(httpRes, { found: false });
    }
    return sendJson(httpRes, serialize({ found: true, ...entitlements }));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
