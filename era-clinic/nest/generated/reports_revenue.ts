import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { bakuDayBounds, todayBakuYmd } from "@/lib/baku-day";
import { loadRevenueStatement } from "@/domain/reports/load-revenue-statement";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/reports/revenue", async (httpReq, httpRes) => {
    if (!(await enterClinicStaff(httpReq, httpRes))) return;
    try {
      const session = await clinicNestSession(httpReq);
      const web = await runWithClinicTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const req = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_REPORTS_PROCEDURES);
    if (denied) return denied;
    if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);

    const url = new URL(req.url);
    const from = (url.searchParams.get("from") ?? todayBakuYmd()).trim();
    const to = (url.searchParams.get("to") ?? from).trim();
    if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
      return sendJson(httpRes, { error: "from and to must be YYYY-MM-DD" }, 400);
    }
    const { start } = bakuDayBounds(from);
    const { end } = bakuDayBounds(to);
    const items = await loadRevenueStatement(start, end);
    const grandTotal = Math.round(items.reduce((sum, row) => sum + row.amount, 0) * 100) / 100;
    return sendJson(httpRes, { items, grandTotal });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
