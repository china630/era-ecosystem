import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { previewWordForOrder } from "@/domain/lab/blank-apply";
import { findLabOrderPayGateFields } from "@/domain/lab/lab-order-write.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  profileId: z.string().min(1).optional(),
  docxBase64: z.string().min(1),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/lab-orders/:id/blank", async (httpReq, httpRes) => {
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

  
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_LAB_ORDERS_BLANK);
    if (denied) return denied;
    const { id } = httpReq.params;
    const order = await findLabOrderPayGateFields(id);
    if (!order) return sendJson(httpRes, { error: "Order not found" }, 404);
    const { labAwaitingPaymentDenied } = await import("@/domain/lab/lab-order-pay-gate");
    // Staff Word import is lab work. Guest print stays on labOrderVisibleToGuestWhere until settledAt.
    const unpaid = labAwaitingPaymentDenied(order);
    if (unpaid) return sendJson(httpRes, { error: unpaid.message, ...{ code: unpaid.code } }, unpaid.status);
    const body = bodySchema.parse(httpReq.body);
    const docx = Buffer.from(body.docxBase64, "base64");
    if (docx.length < 4) return sendJson(httpRes, { error: "Empty file" }, 400);
    const preview = await previewWordForOrder({
      orderId: id,
      docx,
      profileId: body.profileId,
    });
    if (!preview) return sendJson(httpRes, { error: "Order not found" }, 404);
    if (preview.mode === "missing") return sendJson(httpRes, { error: "No Word blank for this panel", ...{ code: "NO_BLANK" } }, 404);
    if (preview.mode === "fields" && Object.keys(preview.fields).length === 0) {
      return sendJson(httpRes, { error: "No panel fields in this file", ...{ code: "NO_USM_FIELDS" } }, 422);
    }
    return sendJson(httpRes, preview);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
