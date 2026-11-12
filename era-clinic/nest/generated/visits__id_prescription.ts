import { SATELLITE_CLINIC_PRESCRIPTION_ISSUED } from "@era/contracts";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { getVisitWithPatientRef } from "@/domain/visit/visit.service";
import { z } from "zod";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const schema = z.object({
  lines: z.array(
    z.object({
      sku: z.string(),
      qty: z.number().positive(),
      rxRequired: z.boolean().optional(),
      description: z.string().optional(),
    }),
  ).min(1),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/visits/:id/prescription", async (httpReq, httpRes) => {
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
    const body = schema.parse(httpReq.body);
    const visit = await getVisitWithPatientRef(id);
    if (!visit) return sendJson(httpRes, { error: "Visit not found" }, 404);
    const { visitAwaitingPaymentDenied } = await import("@/domain/visit/visit-pay-gate");
    const unpaid = visitAwaitingPaymentDenied(visit);
    if (unpaid) return sendJson(httpRes, { error: unpaid.message, ...{ code: unpaid.code } }, unpaid.status);

    await dispatchSatelliteEvent({
      type: SATELLITE_CLINIC_PRESCRIPTION_ISSUED,
      globalPersonId: visit.patientRef.globalPersonId ?? undefined,
      payload: {
        visitId: visit.id,
        patientRef: visit.patientRef.refCode,
        patientOrigin: visit.patientOrigin,
        lines: body.lines,
        currency: "AZN",
      },
    });

    for (const line of body.lines) {
      if (!line.sku.trim()) throw new Error("Finance SKU is required");
    }

    const retailBase = (process.env.RETAIL_POS_URL ?? "http://127.0.0.1:3204").replace(
      /\/$/,
      "",
    );
    const token = process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim() ?? "";
    const queued = await fetch(`${retailBase}/api/integration/prescription-queue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        organizationId: visit.organizationId,
        patientRef: visit.patientRef.refCode,
        visitId: visit.id,
        patientOrigin: visit.patientOrigin,
        reservationId: visit.reservationId,
        lines: body.lines,
      }),
    });
    if (!queued.ok) {
      return sendJson(httpRes, { error: "Pharmacy queue rejected the prescription" }, 502);
    }
    const queueBody = (httpReq.body) as { id?: string; data?: { id?: string } };

    return sendJson(httpRes, {
      visitId: visit.id,
      prescriptionQueueId: queueBody.data?.id ?? queueBody.id ?? null,
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
