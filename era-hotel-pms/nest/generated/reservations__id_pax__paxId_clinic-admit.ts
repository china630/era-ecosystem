import { NextResponse } from 'next/server';
import { serialize } from '@/lib/serialize';
import { admitGuestToClinic, revokeGuestClinicAdmit } from '@/lib/services/clinic-admit.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/reservations/:id/pax/:paxId/clinic-admit", async (httpReq, httpRes) => {
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
    assertPermission(session, PERMISSIONS.RESERVATIONS_CHECKIN);
    const { id, paxId } = httpReq.params;
    const body = ((httpReq.body ?? {})) as { admit?: boolean };
    const result = body.admit === false
      ? await revokeGuestClinicAdmit(id, paxId)
      : await admitGuestToClinic(id, paxId);
    return sendJson(httpRes, serialize(result));
  } catch (err) {
    const status = (err as Error & { status?: number; code?: string }).status;
    const code = (err as { code?: string }).code;
    if (status === 404 || status === 409) {
      const message = err instanceof Error ? err.message : 'Conflict';
      if (code) return sendJson(httpRes, { error: message, code }, ( { status }).status ?? 200);
      return sendJson(httpRes, { error: message }, status);
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
