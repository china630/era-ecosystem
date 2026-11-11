import { NextResponse } from "next/server";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { issueGuestQrToken } from "@era/satellite-kit";
import { findPatientRefForGuestQr } from "@/domain/patient/patient.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/identity/guest-qr", async (httpReq, httpRes) => {
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

  
    const denied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_IDENTITY_GUEST_QR,
    );
    if (denied) return denied;

    const body = (httpReq.body) as { patientRefId?: string };
    if (!body.patientRefId) {
      return sendJson(httpRes, { error: "patientRefId required" }, 400);
    }
    const patient = await findPatientRefForGuestQr(body.patientRefId);
    if (!patient?.globalPersonId) {
      return sendJson(httpRes, { error: "globalPersonId not linked" }, 400);
    }
    const issued = await issueGuestQrToken(patient.globalPersonId);
    if (!issued) {
      return sendJson(httpRes, { error: "issue failed" }, 502);
    }
    return sendJson(httpRes, {
      globalPersonId: patient.globalPersonId,
      ...issued,
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
