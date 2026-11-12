import { countActiveNonCrossSystemUsers } from '@/lib/services/hotel-integration-status.service';
import { runWithSatelliteTenant } from '@era/satellite-kit';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/integration/mock-licensing", async (httpReq, httpRes) => {
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

  
    if (!session) {
      throw Object.assign(new Error('Unauthorized'), { status: 401 });
    }
    const body = (httpReq.body ?? {});
    const organizationId = String(body.organizationId ?? session.organizationId ?? 'unknown');
    const limit = parseInt(process.env.LICENSING_SEAT_LIMIT ?? '10', 10);

    const seatsUsed = await runWithSatelliteTenant({ organizationId: session.organizationId }, () =>
      countActiveNonCrossSystemUsers(),
    );

    const allowed = seatsUsed < limit;

    return sendJson(httpRes, {
      allowed,
      organizationId,
      satelliteType: body.satelliteType ?? 'hotel_pms',
      tier: 'Tier1',
      seatsUsed,
      seatsLimit: limit,
      message: allowed
        ? undefined
        : `Quota exceeded (${seatsUsed}/${limit}). Upgrade tier in ERA Finance.`,
    }, allowed ? 200 : 403);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
