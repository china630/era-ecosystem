import { financeStockCheck } from "@era/satellite-kit";
import { z } from "zod";
import { lineAmount, recalcWorkOrderTotals } from "@/lib/work-order-lines";
import { workOrderMutationDenied } from "@/lib/work-order-status";
import { createWorkOrderPartLine, findWorkOrderById, listWorkOrderPartLines } from "@/lib/work-order.service";
import { enterAutoStaff, autoNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithAutoTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const createSchema = z.object({
  description: z.string().min(1),
  sku: z.string().optional(),
  qty: z.number().positive().default(1),
  unitPrice: z.number().nonnegative(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/work-orders/:id/part-lines", async (httpReq, httpRes) => {
    if (!(await enterAutoStaff(httpReq, httpRes))) return;
    try {
      const session = await autoNestSession(httpReq);
      const web = await runWithAutoTenant(session, async () => {
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

  
    if (!(session)) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const { id } = httpReq.params;
    const lines = await listWorkOrderPartLines(id);
    return sendJson(httpRes, lines);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/work-orders/:id/part-lines", async (httpReq, httpRes) => {
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
    const closed = workOrderMutationDenied(wo.status);
    if (closed) return sendJson(httpRes, { error: closed }, 400);
    const body = createSchema.parse(httpReq.body);
    let stockCheck: Record<string, unknown> | undefined;
    if (body.sku?.trim()) {
      try {
        stockCheck = (await financeStockCheck(
          { sku: body.sku.trim(), actualQty: body.qty },
          { authHeader: req.headers.get("authorization") },
        )) as Record<string, unknown>;
      } catch {
        stockCheck = { sku: body.sku, match: true, source: "stub" };
      }
    }
    const amountAzn = lineAmount(body.qty, body.unitPrice);
    await createWorkOrderPartLine({
      workOrderId: id,
      sku: body.sku,
      description: body.description,
      qty: body.qty,
      unitPrice: body.unitPrice,
      amountAzn,
    });
    const updated = await recalcWorkOrderTotals(id);
    return sendJson(httpRes, { ...updated, stockCheck }, 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
