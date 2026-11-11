import { serialize } from '@/lib/serialize';
import { listAgencies } from '@/lib/services/agency-ledger.service';
import { assertAnyPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { sessionHasHotelPermission } from '@/lib/auth/permission-check';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/agencies", async (httpReq, httpRes) => {
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

  
    assertAnyPermission(session, [
      PERMISSIONS.REPORTS_READ,
      PERMISSIONS.BOOKING_AGENCY_PICK,
      PERMISSIONS.SCREEN_DISTRIBUTION,
    ]);
    const rows = await listAgencies();
    const fullLedger = sessionHasHotelPermission(
      {
        login: session!.login,
        email: session!.email,
        role: session!.role,
        permissions: session!.permissions,
        isOwner: session!.isOwner,
      },
      PERMISSIONS.REPORTS_READ,
    );
    const payload = fullLedger
      ? rows
      : rows
          .filter((row) => row.active)
          .map((row) => ({ id: row.id, code: row.code, name: row.name, active: row.active }));
    return sendJson(httpRes, serialize(payload));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
