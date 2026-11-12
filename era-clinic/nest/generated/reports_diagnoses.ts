import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { listDiagnosisReport } from "@/domain/icd/diagnosis-report.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/reports/diagnoses", async (httpReq, httpRes) => {
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

  
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_REPORTS_DIAGNOSES);
    if (denied) return denied;

        const url = new URL(req.url);
    const from = url.searchParams.get("from") ?? "";
    const to = url.searchParams.get("to") ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return sendJson(httpRes, { error: "from and to must be YYYY-MM-DD" }, 400);
    }
    const source = url.searchParams.get("source") ?? "all";
    const chapter = url.searchParams.get("chapter") ?? "";
    const locale = url.searchParams.get("locale") ?? "en";
    return sendJson(httpRes, 
      await listDiagnosisReport({
        fromYmd: from,
        toYmd: to,
        source:
          source === "episode" || source === "visit" || source === "admission"
            ? source
            : "all",
        chapter: chapter || undefined,
        locale,
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
