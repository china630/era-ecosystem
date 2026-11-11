import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { todayBakuYmd } from "@/lib/baku-day";
import { loadPaidPunchReport, type PaidPunchKind } from "@/domain/reports/paid-punch-report";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const kindSchema = z.enum(["procedure", "lab", "diagnostic", ""]);

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/reports/paid-punches", async (httpReq, httpRes) => {
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

    const url = new URL(req.url);
    const today = todayBakuYmd();
    const from = (url.searchParams.get("from") ?? `${today.slice(0, 8)}01`).trim();
    const to = (url.searchParams.get("to") ?? today).trim();
    if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
      return sendJson(httpRes, { error: "from and to must be YYYY-MM-DD" }, 400);
    }
    const kind = kindSchema.parse((url.searchParams.get("kind") ?? "").trim()) as PaidPunchKind | "";
    const report = await loadPaidPunchReport({
      from,
      to,
      kind,
      room: url.searchParams.get("room") ?? "",
      guest: url.searchParams.get("guest") ?? "",
      code: url.searchParams.get("code") ?? "",
      doctorId: url.searchParams.get("doctorId") ?? "",
      cashierId: url.searchParams.get("cashierId") ?? "",
      locale: url.searchParams.get("locale") ?? "az",
    });
    return sendJson(httpRes, report);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
