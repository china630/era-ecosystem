import { z } from "zod";
import { lineAmount, recalcWorkOrderTotals } from "@/lib/work-order-lines";
import { workOrderMutationDenied } from "@/lib/work-order-status";
import { createWorkOrderLaborLine, findWorkOrderById, listWorkOrderLaborLines } from "@/lib/work-order.service";
import { enterAutoStaff, autoNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithAutoTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const createSchema = z.object({
  description: z.string().min(1),
  hours: z.number().positive().default(1),
  rateAzn: z.number().nonnegative(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/work-orders/:id/labor-lines", async (httpReq, httpRes) => {
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
    const lines = await listWorkOrderLaborLines(id);
    return sendJson(httpRes, lines);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/work-orders/:id/labor-lines", async (httpReq, httpRes) => {
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
    const amountAzn = lineAmount(body.hours, body.rateAzn);
    await createWorkOrderLaborLine({
      workOrderId: id,
      description: body.description,
      hours: body.hours,
      rateAzn: body.rateAzn,
      amountAzn,
    });
    const updated = await recalcWorkOrderTotals(id);
    return sendJson(httpRes, updated, 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
