import { z } from "zod";
import { findWorkOrderById, updateWorkOrderShopFloorEnd, updateWorkOrderShopFloorStart } from "@/lib/work-order.service";
import { enterAutoStaff, autoNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithAutoTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  action: z.enum(["start", "stop"]),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/work-orders/:id/shop-floor", async (httpReq, httpRes) => {
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
    const body = bodySchema.parse(httpReq.body);
    const wo = await findWorkOrderById(id);
    if (!wo) return sendJson(httpRes, { error: "Work order not found" }, 404);

    if (body.action === "start") {
      const updated = await updateWorkOrderShopFloorStart(id);
      return sendJson(httpRes, updated);
    }

    const started = wo.shopFloorStartedAt;
    const ended = new Date();
    const minutes = started
      ? Math.round((ended.getTime() - started.getTime()) / 60000)
      : 0;
    const updated = await updateWorkOrderShopFloorEnd(id);
    return sendJson(httpRes, { ...updated, shopFloorMinutes: minutes });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
