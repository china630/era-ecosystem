import { z } from "zod";
import { financeExternalPurchase } from "@era/satellite-kit";
import { findWorkOrderById } from "@/lib/work-order.service";
import { enterAutoStaff, autoNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithAutoTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  lines: z.array(
    z.object({
      sku: z.string(),
      quantity: z.number().min(0.0001),
      unitPrice: z.number().optional(),
    }),
  ),
  counterpartyId: z.string().uuid().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/work-orders/:id/parts-order", async (httpReq, httpRes) => {
    if (!(await enterAutoStaff(httpReq, httpRes))) return;
    try {
      const session = await autoNestSession(httpReq);
      const web = await runWithAutoTenant(session, async () => {
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

  
    if (!(session)) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const { id } = httpReq.params;
    const wo = await findWorkOrderById(id);
    if (!wo) return sendJson(httpRes, { error: "Work order not found" }, 404);
    const body = bodySchema.parse(httpReq.body);
    const result = await financeExternalPurchase(
      { externalRef: `WO-${wo.code}`, lines: body.lines, counterpartyId: body.counterpartyId },
      { authHeader: req.headers.get("authorization") },
    );
    return sendJson(httpRes, { workOrderId: id, ...result });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
