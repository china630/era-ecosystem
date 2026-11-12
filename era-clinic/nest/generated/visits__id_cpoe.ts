import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { createVisitCpoeEntry, getVisitForWrite, listVisitCpoeEntries, visitExists } from "@/domain/visit/visit.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  templateId: z.string().optional(),
  payloadJson: z.string().default("{}"),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/visits/:id/cpoe", async (httpReq, httpRes) => {
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

  
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_VISITS_READ);
    if (denied) return denied;

    const { id } = httpReq.params;
    if (!(await visitExists(id))) return sendJson(httpRes, { error: "Visit not found" }, 404);

    const entries = await listVisitCpoeEntries(id);
    return sendJson(httpRes, { items: entries });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/visits/:id/cpoe", async (httpReq, httpRes) => {
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

  
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_VISITS);
    if (denied) return denied;

    const { id } = httpReq.params;
    const visit = await getVisitForWrite(id);
    if (!visit) return sendJson(httpRes, { error: "Visit not found" }, 404);
    const { visitAwaitingPaymentDenied } = await import("@/domain/visit/visit-pay-gate");
    const unpaid = visitAwaitingPaymentDenied(visit);
    if (unpaid) return sendJson(httpRes, { error: unpaid.message, ...{ code: unpaid.code } }, unpaid.status);
    const body = bodySchema.parse(httpReq.body);
    const entry = await createVisitCpoeEntry({
      visitId: id,
      templateId: body.templateId,
      payloadJson: body.payloadJson,
    });
    return sendJson(httpRes, entry, 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
