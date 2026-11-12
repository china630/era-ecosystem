import { z } from "zod";
import { assertOpsApiPermission } from "@/lib/auth/clinic-ops-guard";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { createImportedLabOrder } from "@/domain/lab/lab-order-write.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const MAX_EXTERNAL_AGE_DAYS = 90;

const bodySchema = z.object({
  patientRefId: z.string(),
  testCode: z.string(),
  results: z.array(
    z.object({
      analyte: z.string(),
      value: z.string(),
      refMin: z.number().optional(),
      refMax: z.number().optional(),
      flag: z.string().optional(),
    }),
  ),
  source: z.enum(["IN_HOUSE", "EXTERNAL"]).default("EXTERNAL"),
  resultDate: z.string().min(1),
});

/** Legacy alias of /api/lab-orders/import — create/results need api:lab_orders.write. */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/lab/import", async (httpReq, httpRes) => {
    try {
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const req = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    const gate = await assertOpsApiPermission(req, CLINIC_PERMISSION.API_LAB_ORDERS_WRITE);
    if (gate.error) return gate.error;

    const body = bodySchema.parse(httpReq.body);
    const resultDate = new Date(body.resultDate);
    if (Number.isNaN(resultDate.getTime())) {
      return sendJson(httpRes, { error: "Invalid resultDate" }, 400);
    }
    const ageMs = Date.now() - resultDate.getTime();
    if (ageMs > MAX_EXTERNAL_AGE_DAYS * 24 * 60 * 60 * 1000) {
      return sendJson(httpRes, { error: 
        `External lab results older than ${MAX_EXTERNAL_AGE_DAYS} days are not accepted` }, 400);
    }
    if (ageMs < -24 * 60 * 60 * 1000) {
      return sendJson(httpRes, { error: "resultDate cannot be in the future" }, 400);
    }

    const order = await createImportedLabOrder({
      patientRefId: body.patientRefId,
      code: body.testCode,
      results: body.results,
      source: body.source,
      resultDate,
    });
    return sendJson(httpRes, { orderId: order.id, imported: body.results.length }, 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
