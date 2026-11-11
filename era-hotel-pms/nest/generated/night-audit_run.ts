import { serialize } from '@/lib/serialize';
import { runNightAudit } from '@/lib/services/night-audit.service';
import { QaimeDayCloseBlockedError, QaimeDayCloseUnreachableError } from '@/lib/services/qaime-day-close-gate';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/night-audit/run", async (httpReq, httpRes) => {
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

  try {
    assertPermission(session, PERMISSIONS.NIGHT_AUDIT_RUN);
    const result = await runNightAudit({ userId: session?.sub, request });
    return sendJson(httpRes, serialize(result));
  } catch (err) {
    if (err instanceof QaimeDayCloseBlockedError) {
      return sendJson(httpRes, 
        { error: err.message, code: err.code, gaps: err.gaps }, (
        { status: err.status }).status ?? 200);
    }
    if (err instanceof QaimeDayCloseUnreachableError) {
      return sendJson(httpRes, { error: err.message, code: err.code }, ( { status: err.status }).status ?? 200);
    }
    return sendRouteError(httpRes, err);
  }

        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
