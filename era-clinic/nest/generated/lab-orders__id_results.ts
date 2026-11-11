import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { assertLabOrderDataScope } from "@/lib/auth/clinic-data-scope";
import { findLabOrderById, writeLabResultsForOrder } from "@/domain/lab/lab-order-write.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  lines: z
    .array(
      z.object({
        code: z.string(),
        value: z.string(),
        unit: z.string().optional(),
        refMin: z.string().optional(),
        refMax: z.string().optional(),
        normTextEn: z.string().optional(),
        normTextRu: z.string().optional(),
        normTextAz: z.string().optional(),
        boundKind: z
          .enum(["INTERVAL", "UPPER_ONLY", "LOWER_ONLY", "QUALITATIVE", "ZONES"])
          .optional(),
        flag: z.enum(["NORMAL", "HIGH", "LOW", "CRITICAL"]).optional(),
      }),
    )
    .min(1),
});

/** Editable while COLLECTED/IN_PROGRESS/RESULT_READY — re-entry allowed until PUBLISHED. */
const EDITABLE_STATUSES = ["COLLECTED", "IN_PROGRESS", "RESULT_READY"];

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/lab-orders/:id/results", async (httpReq, httpRes) => {
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

  
    if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_LAB_ORDERS_WRITE);
    if (denied) return denied;

    const { id } = httpReq.params;
    const scopeDenied = await assertLabOrderDataScope(session, id);
    if (scopeDenied) return scopeDenied;
    const body = bodySchema.parse(httpReq.body);
    const order = await findLabOrderById(id);
    if (!order) return sendJson(httpRes, { error: "Lab order not found" }, 404);
    const { labAwaitingPaymentDenied } = await import("@/domain/lab/lab-order-pay-gate");
    const unpaid = labAwaitingPaymentDenied(order);
    if (unpaid) return sendJson(httpRes, { error: unpaid.message, ...{ code: unpaid.code } }, unpaid.status);
    if (!EDITABLE_STATUSES.includes(order.status)) {
      return sendJson(httpRes, { error: `Cannot enter results from status ${order.status}` }, 400);
    }

    const result = await writeLabResultsForOrder(id, body.lines);
    if (!result) return sendJson(httpRes, { error: "Lab order not found" }, 404);

    return sendJson(httpRes, {
      ...result.order,
      hasCritical: result.hasCritical,
      resultLines: result.enrichedLines,
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
