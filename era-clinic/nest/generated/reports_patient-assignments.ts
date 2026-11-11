import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { loadPatientAssignmentLedger, type AssignmentKind } from "@/domain/reports/patient-assignment-ledger";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/reports/patient-assignments", async (httpReq, httpRes) => {
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

  
    const denied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_REPORTS_PROCEDURES,
    );
    if (denied) return denied;
    if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);

    const url = new URL(req.url);
    const episodeId = (url.searchParams.get("episodeId") ?? "").trim();
    if (!episodeId) return sendJson(httpRes, { error: "episodeId required" }, 400);

    const roomNumber = url.searchParams.get("roomNumber")?.trim() || null;
    const kindRaw = url.searchParams.get("kind")?.trim() || "all";
    const kind =
      kindRaw === "procedure" || kindRaw === "lab" || kindRaw === "visit"
        ? (kindRaw as AssignmentKind)
        : "all";

    const data = await loadPatientAssignmentLedger({
      episodeId,
      roomNumber,
      kind,
    });
    if (!data) return sendJson(httpRes, { error: "Episode not found" }, 404);
    return sendJson(httpRes, data);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
