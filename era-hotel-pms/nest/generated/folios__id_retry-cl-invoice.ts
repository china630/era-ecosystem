import { serialize } from '@/lib/serialize';
import { todayBakuYmd } from '@era/satellite-kit/time';
import { handoffPendingCityLedger } from '@/lib/services/city-ledger-night-handoff.service';
import { getFolioCityLedgerRetryMeta } from '@/lib/services/folio.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

/**
 * Same rule as night audit: transfer this PENDING_AR folio only when Finance already has the VÖEN card.
 */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/folios/:id/retry-cl-invoice", async (httpReq, httpRes) => {
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
    const folio = await getFolioCityLedgerRetryMeta(id);
    if (!folio) {
      return sendJson(httpRes, { error: 'Folio not found', code: 'NOT_FOUND' }, 404);
    }
    if (folio.type !== 'AGENCY' && folio.type !== 'COMPANY') {
      return sendJson(httpRes, 
        { error: 'Only agency or company folios can retry City Ledger invoice', code: 'INVALID_FOLIO' }, 409);
    }
    if (folio.status !== 'PENDING_AR') {
      return sendJson(httpRes, 
        { error: 'Folio is not waiting for the night City Ledger handoff', code: 'INVALID_STATUS' }, 409);
    }

    const lines = await handoffPendingCityLedger(todayBakuYmd(), folio.id);
    const failed = lines.find((line) => line.level === 'exception');
    if (failed) {
      return sendJson(httpRes, { error: failed.message, code: 'CL_CARD_MISSING' }, 409);
    }
    return sendJson(httpRes, serialize({ folioId: folio.id, status: 'TRANSFERRED_AR', lines }));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
