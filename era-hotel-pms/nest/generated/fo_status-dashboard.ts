import { serialize } from '@/lib/serialize';
import { assertAnyPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { todayBakuYmd } from '@era/satellite-kit/time';
import { getFoStatusDashboard } from '@/lib/services/fo-status-dashboard.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/fo/status-dashboard", async (httpReq, httpRes) => {
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

  
    assertAnyPermission(session, [PERMISSIONS.REPORTS_READ, PERMISSIONS.RESERVATIONS_READ]);
    const url = new URL(request.url);
    const dateParam = url.searchParams.get('date');
    const day = dateParam && YMD.test(dateParam) ? dateParam : todayBakuYmd();
    const includeWaiting = url.searchParams.get('waiting') === '1';
    const withRevenue = url.searchParams.get('revenue') === '1';
    return sendJson(httpRes, 
      serialize(
        await getFoStatusDashboard(session.organizationId, day, { includeWaiting, withRevenue }),
      ),
    );
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
