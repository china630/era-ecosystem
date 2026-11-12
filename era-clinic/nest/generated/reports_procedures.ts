import { z } from "zod";
import { requireClinicPermission, sessionHasClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { todayBakuYmd } from "@/lib/baku-day";
import { runProcedureReport } from "@/domain/reports/procedure-report.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const viewSchema = z.enum([
  "fulfillment",
  "doctor-lines",
  "doctor-bonus",
  "by-procedure",
  "nurse-work",
]);

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/reports/procedures", async (httpReq, httpRes) => {
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
    const viewRaw = (url.searchParams.get("view") ?? "fulfillment").trim();
    const view = viewSchema.parse(viewRaw);

    const from = (url.searchParams.get("from") ?? todayBakuYmd()).trim();
    const to = (url.searchParams.get("to") ?? from).trim();
    if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
      return sendJson(httpRes, { error: "from and to must be YYYY-MM-DD" }, 400);
    }

    const procedureCode = url.searchParams.get("procedure")?.trim() || undefined;
    const paid = url.searchParams.get("paid")?.trim();
    const origin = url.searchParams.get("origin")?.trim() || undefined;
    const doctorIdParam = url.searchParams.get("doctorId")?.trim() || undefined;
    const nurseIdParam = url.searchParams.get("nurseId")?.trim() || undefined;
    const statusFilter = url.searchParams.get("status")?.trim();

    const isNurseDesk = sessionHasClinicPermission(session, CLINIC_PERMISSION.SCREEN_NURSE);

    const payload = await runProcedureReport({
      view,
      from,
      to,
      procedureCode,
      paid,
      origin,
      doctorId: doctorIdParam,
      nurseId: nurseIdParam,
      statusFilter,
      sessionUserId: session.sub,
      isNurseDesk,
    });

    return sendJson(httpRes, payload);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
