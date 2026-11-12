import { todayBakuYmd } from '@era/satellite-kit/time';
import { serialize } from '@/lib/serialize';
import { requireAgencyPortalSession } from '@/lib/auth/agency-session';
import { getAgencyLedger } from '@/lib/services/agency-ledger.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

/**
 * Agency portal City Ledger statement (read-only).
 * Scoped to session.agencyId — never accepts party id from query.
 */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/agency/ledger", async (httpReq, httpRes) => {
    try {
    if (rejectMissingAgency(httpReq, httpRes)) return;
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    const session = await requireAgencyPortalSession();
    const url = new URL(request.url);
    const fromStr = url.searchParams.get('from') ?? todayBakuYmd();
    const toStr = url.searchParams.get('to') ?? fromStr;
    const from = new Date(fromStr);
    const to = new Date(toStr);
    to.setHours(23, 59, 59, 999);
    const ledger = await getAgencyLedger(session.agencyId, from, to);
    return sendJson(httpRes, 
      serialize({
        agencyId: session.agencyId,
        agencyCode: session.agencyCode,
        from: fromStr,
        to: toStr,
        opening: ledger.opening,
        newCharges: ledger.newCharges,
        payments: ledger.payments,
        cashPaid: ledger.cashPaid,
        netAmount: ledger.netAmount,
        cityLedger: ledger.cityLedger,
        closing: ledger.closing,
        statementBalance: ledger.statementBalance,
        reservationCount: ledger.reservationCount,
        folioCount: ledger.folioCount,
        lines: ledger.lines,
      }),
    );
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
