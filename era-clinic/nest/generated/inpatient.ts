import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { admitPatient, dischargeAdmission, listInpatientCensus, listWardsWithPatients, transferAdmission } from "@/domain/inpatient/adt.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const admitSchema = z.object({
  action: z.enum(["admit", "transfer", "discharge"]).optional(),
  bedId: z.string().optional(),
  patientRefId: z.string().optional(),
  admissionId: z.string().optional(),
  newBedId: z.string().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/inpatient", async (httpReq, httpRes) => {
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

  
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_INPATIENT_READ);
    if (denied) return denied;

        const view = new URL(req.url).searchParams.get("view");
    if (view === "census") {
      return sendJson(httpRes, { items: await listInpatientCensus() });
    }
    const wards = await listWardsWithPatients();
    return sendJson(httpRes, { wards });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/inpatient", async (httpReq, httpRes) => {
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

  try {
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_INPATIENT);
    if (denied) return denied;

        const body = admitSchema.parse(httpReq.body);
    const action = body.action ?? "admit";

    if (action === "admit") {
      if (!body.bedId || !body.patientRefId) {
        return sendJson(httpRes, { error: "bedId and patientRefId required" }, 400);
      }
      const result = await admitPatient(body.patientRefId, body.bedId);
      return sendJson(httpRes, result, 201);
    }
    if (action === "transfer") {
      if (!body.admissionId || !body.newBedId) {
        return sendJson(httpRes, { error: "admissionId and newBedId required" }, 400);
      }
      const assignment = await transferAdmission(body.admissionId, body.newBedId);
      return sendJson(httpRes, { assignment });
    }
    if (action === "discharge") {
      if (!body.admissionId) return sendJson(httpRes, { error: "admissionId required" }, 400);
      const admission = await dischargeAdmission(body.admissionId);
      return sendJson(httpRes, { admission });
    }
    return sendJson(httpRes, { error: "Unknown action" }, 400);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    if (msg.includes("occupied") || msg.includes("not available")) {
      return sendJson(httpRes, { error: msg }, 409);
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
