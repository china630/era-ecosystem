import { z } from 'zod';
import { todayBakuYmd } from '@era/satellite-kit/time';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getEodReport, type EodReportType } from '@/lib/services/night-audit-eod-reports.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const typeSchema = z.enum([
  'cancelled',
  'created',
  'folio-transactions',
  'room-price-control',
  'no-shows',
  'room-moves',
  'vip-in-house',
]);

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/night-audit/eod-reports", async (httpReq, httpRes) => {
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
    const url = new URL(request.url);
    const parsed = typeSchema.safeParse(url.searchParams.get('type'));
    if (!parsed.success) {
      return sendJson(httpRes, { error: 
        'type must be cancelled|created|folio-transactions|room-price-control|no-shows|room-moves|vip-in-house' }, 400);
    }
    const today = todayBakuYmd();
    const date = url.searchParams.get('date') ?? today;
    return sendJson(httpRes, serialize(await getEodReport(parsed.data as EodReportType, date)));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
