import { requestOrganizationId } from '@/lib/request-organization';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const CP_URL = process.env.CONTROL_PLANE_URL?.replace(/\/$/, '');
const CP_TOKEN =
  process.env.CONTROL_PLANE_SERVICE_TOKEN?.trim() ||
  process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim();

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/loyalty/balance", async (httpReq, httpRes) => {
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

  
    assertPermission(session, PERMISSIONS.FOLIO_READ);
    const customerRef = new URL(request.url).searchParams.get('customerRef');
    if (!customerRef) throw new Error('customerRef required');

    const orgId = requestOrganizationId();
    if (!CP_URL || !CP_TOKEN || !orgId || orgId === 'demo-org') {
      return sendJson(httpRes, { balance: 0, maxRedeemableAzn: 0, mode: 'mock', pointsPerAzn: 100 });
    }

    const res = await fetch(
      `${CP_URL}/api/platform/loyalty/v1/points/balance?customerRef=${encodeURIComponent(customerRef)}`,
      {
        headers: {
          Authorization: `Bearer ${CP_TOKEN}`,
          'X-Organization-Id': orgId,
        },
      },
    );
    if (!res.ok) throw new Error('Balance lookup failed');
    const data = (httpReq.body) as { balance?: number };
    const points = data.balance ?? 0;
    const pointsPerAzn = Number(process.env.LOYALTY_POINTS_PER_AZN ?? '100');
    return sendJson(httpRes, {
      balance: points,
      maxRedeemableAzn: Math.floor(points / pointsPerAzn),
      pointsPerAzn,
      mode: 'live',
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
