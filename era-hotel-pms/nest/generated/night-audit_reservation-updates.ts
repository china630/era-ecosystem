import { NextResponse } from 'next/server';
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { bakuDayBounds, todayBakuYmd } from '@era/satellite-kit/time';
import { listNightAuditReservationUpdates, reservationUpdatesToCsv, type UpdateActionKind } from '@/lib/services/night-audit-updates.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const actionSchema = z.enum(['ALL', 'CANCEL', 'EXTEND', 'NOTE', 'OTHER']);

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/night-audit/reservation-updates", async (httpReq, httpRes) => {
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
    const today = todayBakuYmd();
    const from = bakuDayBounds(url.searchParams.get('from') ?? today).start;
    const to = bakuDayBounds(url.searchParams.get('to') ?? today).start;
    const action = actionSchema.parse(url.searchParams.get('action') ?? 'ALL') as UpdateActionKind;
    const rows = await listNightAuditReservationUpdates({ from, to, action });
    if (url.searchParams.get('format') === 'csv') {
      const csv = reservationUpdatesToCsv(rows);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="reservation-updates-${url.searchParams.get('from') ?? today}.csv"`,
        },
      });
    }
    return sendJson(httpRes, serialize(rows));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
