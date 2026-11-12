import { serialize } from '@/lib/serialize';
import { todayBakuYmd } from '@era/satellite-kit/time';
import { listCityLedgerSummary } from '@/lib/services/agency-ledger.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/reports/agency-cl-summary", async (httpReq, httpRes) => {
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

  
    assertPermission(session, PERMISSIONS.REPORTS_READ);
    const params = new URL(request.url).searchParams;
    const from = new Date(params.get('from') ?? todayBakuYmd());
    const to = new Date(params.get('to') ?? todayBakuYmd());
    to.setHours(23, 59, 59, 999);
    const kind = (params.get('kind') ?? 'ALL').toUpperCase();
    const scoped = kind === 'COMPANY' || kind === 'AGENCY' ? kind : 'ALL';
    return sendJson(httpRes, serialize(await listCityLedgerSummary(from, to, scoped)));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
