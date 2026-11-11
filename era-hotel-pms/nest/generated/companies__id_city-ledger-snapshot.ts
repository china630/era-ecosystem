import { z } from 'zod';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { dispatchCompanyCityLedgerSnapshot } from '@/lib/integration/event-dispatcher';
import { recordHotelAudit } from '@/lib/satellite-audit';
import { todayBakuYmd } from '@era/satellite-kit/time';
import { getLastCityLedgerSnapshotAudit } from '@/lib/services/city-ledger-gate.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const postSchema = z.object({
  asOfDate: z.string().min(8).optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/companies/:id/city-ledger-snapshot", async (httpReq, httpRes) => {
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
    const { id } = httpReq.params;
    const last = await getLastCityLedgerSnapshotAudit(id);
    return sendJson(httpRes, {
      companyId: id,
      lastSnapshot: last
        ? {
            at: last.createdAt,
            action: last.action,
            changes: last.changesJson ? JSON.parse(last.changesJson) : null,
          }
        : null,
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/companies/:id/city-ledger-snapshot", async (httpReq, httpRes) => {
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

  
    assertPermission(session, PERMISSIONS.FOLIO_PAYMENT);
    const { id } = httpReq.params;
    const body = postSchema.parse((httpReq.body ?? {}));
    const asOfDate = body.asOfDate ?? todayBakuYmd();
    const result = await dispatchCompanyCityLedgerSnapshot(id, asOfDate);
    await recordHotelAudit({ userId: session?.sub, request }, 'CityLedgerSnapshot', id, 'PUSH', {
      asOfDate,
      party: 'COMPANY',
      result,
    });
    return sendJson(httpRes, { ok: true, asOfDate, result });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
