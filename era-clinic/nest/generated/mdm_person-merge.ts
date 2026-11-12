import { z } from "zod";
import { mergePersonRecords } from "@era/satellite-kit";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { linkPatientGlobalPerson } from "@/lib/patient-identity";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const schema = z.object({
  patientRefId: z.string(),
  sourcePersonId: z.string().uuid(),
  targetPersonId: z.string().uuid(),
  fin: z.string().trim().min(7),
  fullName: z.string().trim().min(1),
});

/** Ops: foreigner received FIN — merge MDM records and re-link patient. */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/mdm/person-merge", async (httpReq, httpRes) => {
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

  
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_MDM);
    if (denied) return denied;

    const body = schema.parse(httpReq.body);
    const merged = await mergePersonRecords(body.sourcePersonId, body.targetPersonId);
    if (!merged.globalPersonId) {
      return sendJson(httpRes, { error: "MDM merge failed" }, 502);
    }
    await linkPatientGlobalPerson({
      patientRefId: body.patientRefId,
      fin: body.fin,
      fullName: body.fullName,
    });
    return sendJson(httpRes, { globalPersonId: merged.globalPersonId });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
