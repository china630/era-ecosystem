import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { dischargeAdmission } from "@/domain/inpatient/adt.service";
import { getBedAssignmentDischargeMeta } from "@/domain/patient/patient.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.patch("/api/inpatient/assignments/:id", async (httpReq, httpRes) => {
    if (!(await enterClinicStaff(httpReq, httpRes))) return;
    try {
      const session = await clinicNestSession(httpReq);
      const web = await runWithClinicTenant(session, async () => {
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
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_INPATIENT);
    if (denied) return denied;

    const { id } = httpReq.params;
    const assignment = await getBedAssignmentDischargeMeta(id);
    if (!assignment) return sendJson(httpRes, { error: "Assignment not found" }, 404);
    if (assignment.dischargedAt) return sendJson(httpRes, { error: "Already discharged" }, 400);
    if (!assignment.admissionId) return sendJson(httpRes, { error: "Admission not linked" }, 400);
    const admission = await dischargeAdmission(assignment.admissionId);
    return sendJson(httpRes, admission);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    if (msg.includes("not found")) return sendJson(httpRes, { error: msg }, 404);
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
