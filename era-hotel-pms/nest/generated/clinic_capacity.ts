import { NextResponse } from 'next/server';
import { fetchClinicCapacitySummary } from '@/lib/integration/clinic-capacity-client';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

/** Session proxy for ops UI - server holds CLINIC_BRIDGE_SECRET. */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/clinic/capacity", async (httpReq, httpRes) => {
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

  
    if (!session) return sendJson(httpRes, { error: 'Unauthorized' }, 401);
    const url = new URL(request.url);
    const date = url.searchParams.get('date');
    const ref = date ? new Date(date) : new Date();
    const summary = await fetchClinicCapacitySummary(session.organizationId, ref);
    if (!summary) {
      return sendJson(httpRes, { riskLevel: 'ok', bookingAllowed: true, configured: false });
    }
    return sendJson(httpRes, { ...summary, configured: true });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
